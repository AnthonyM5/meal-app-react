-- ============================================================
-- search_canonical_ingredients: compute the live variant count AFTER the
-- LIMIT, not before it.
--
-- Migration 20260803000100 introduced a live count to replace the stale
-- build-time snapshot in canonical_ingredients.variant_count. Its header
-- claimed:
--
--   "The count runs per RETURNED group (match_limit, default 25)"
--
-- It does not. The count was a CROSS JOIN LATERAL in the FROM clause, so it
-- ran for every candidate row surviving the WHERE — and the WHERE is
-- deliberately permissive (set_limit(0.2) plus three OR'd trigram predicates,
-- for recall). A broad query like "beef" or "oil" matches far more than 25
-- groups, so the count ran far more than 25 times.
--
-- Worse, `vc.n` also appeared in the ORDER BY. That makes the count a sort
-- key, so it MUST be materialized for every candidate before the sort can
-- run: no planner can defer it past the LIMIT, however it is written. The
-- cost scaled with matches, not with rows returned.
--
-- Each lookup is individually cheap (foods_canonical_id_idx), but the index
-- does not carry is_active, so every one also does heap fetches for the rows
-- it finds. N cheap-but-not-free lookups on a hot search path.
--
-- Fix: two stages. Select and LIMIT first, then count only the survivors.
--
--   stage 1 (`top`)  rank and cut to match_limit rows
--   stage 2          LATERAL count over exactly those rows, then re-sort
--
-- The count now runs exactly match_limit times (25 by default), which is what
-- the original comment promised.
--
-- SEMANTIC NOTE — one deliberate, narrow difference.
--
-- The ordering key is unchanged:
--     score DESC, is_safe_for_dogs DESC, variant_count DESC, display_name
-- but stage 1 cannot use the LIVE count as its third tiebreak, because
-- computing it there is the very thing being avoided. It uses the STORED
-- c.variant_count instead; stage 2 then re-sorts the returned rows on the live
-- count, so THE RETURNED ORDER IS IDENTICAL.
--
-- The only reachable difference is membership at the cut line: if two groups
-- tie on both score and safety, straddle position `match_limit`, and their
-- stored counts disagree with their live counts, a different one is kept. That
-- needs a score tie, a safety tie, a boundary straddle, and drift since the
-- last scripts/026 build, all at once — and it decides rank 25 vs 26 of a
-- fuzzy search. Paying an unbounded per-query cost to close it is the wrong
-- trade.
--
-- Return type unchanged, so no DROP and no client changes.
-- ============================================================

CREATE OR REPLACE FUNCTION public.search_canonical_ingredients(
    search_query TEXT,
    match_limit INT DEFAULT 25
)
RETURNS TABLE (
    canonical_id     UUID,
    slug             TEXT,
    display_name     TEXT,
    base_food        TEXT,
    part             TEXT,
    category         TEXT,
    variant_count    INT,
    group_is_safe    BOOLEAN,
    food_id          UUID,
    name             TEXT,
    brand            TEXT,
    serving_size     DECIMAL,
    calories_per_serving DECIMAL,
    protein_g        DECIMAL,
    carbs_g          DECIMAL,
    fat_g            DECIMAL,
    fiber_g          DECIMAL,
    preparation_state TEXT,
    is_verified      BOOLEAN,
    source           TEXT,
    data_completeness TEXT,
    similarity       REAL
) AS $$
BEGIN
    PERFORM set_limit(0.2);
    PERFORM set_config('pg_trgm.word_similarity_threshold', '0.5', true);

    RETURN QUERY
    WITH top AS (
        -- Stage 1: rank and cut. No live count here — that is the point.
        -- Every output column is prefixed g_/f_ so nothing collides with the
        -- RETURNS TABLE names, which are OUT variables inside plpgsql.
        SELECT
            c.id                  AS g_id,
            c.slug                AS g_slug,
            c.display_name        AS g_display_name,
            c.base_food           AS g_base_food,
            c.part                AS g_part,
            c.category            AS g_category,
            c.is_safe_for_dogs    AS g_is_safe,
            f.id                  AS f_id,
            f.name                AS f_name,
            f.brand               AS f_brand,
            f.serving_size        AS f_serving_size,
            f.calories_per_serving AS f_calories_per_serving,
            f.protein_g           AS f_protein_g,
            f.carbs_g             AS f_carbs_g,
            f.fat_g               AS f_fat_g,
            f.fiber_g             AS f_fiber_g,
            f.preparation_state   AS f_preparation_state,
            f.is_verified         AS f_is_verified,
            f.source              AS f_source,
            f.data_completeness   AS f_data_completeness,
            (
                  0.60 * similarity(c.display_name, search_query)
                + 0.40 * similarity(c.base_food, search_query)
            )::REAL               AS g_score
        FROM public.canonical_ingredients c
        JOIN public.foods f
          ON f.canonical_id = c.id
         AND f.is_canonical_default
         AND f.is_active
        WHERE
            -- word_similarity stays HERE, for recall: a one-word query against
            -- a multi-word display name has low whole-string similarity, so
            -- `%` alone would drop real matches. It just no longer drives
            -- ranking.
            c.display_name % search_query
            OR c.base_food % search_query
            OR search_query <% c.display_name
        ORDER BY
            g_score DESC,
            c.is_safe_for_dogs DESC,
            -- Stored snapshot, used ONLY to break ties at the cut line. The
            -- returned rows are re-sorted on the live count below.
            c.variant_count DESC,
            c.display_name
        LIMIT match_limit
    )
    -- Stage 2: live count over the <= match_limit survivors, then the real
    -- ordering.
    SELECT
        t.g_id,
        t.g_slug,
        t.g_display_name,
        t.g_base_food,
        t.g_part,
        t.g_category,
        vc.n,
        t.g_is_safe,
        t.f_id,
        t.f_name,
        t.f_brand,
        t.f_serving_size,
        t.f_calories_per_serving,
        t.f_protein_g,
        t.f_carbs_g,
        t.f_fat_g,
        t.f_fiber_g,
        t.f_preparation_state,
        t.f_is_verified,
        t.f_source,
        t.f_data_completeness,
        t.g_score
    FROM top t
    CROSS JOIN LATERAL (
        SELECT COUNT(*)::INT AS n
        FROM public.foods v
        WHERE v.canonical_id = t.g_id
          AND v.is_active
    ) vc
    ORDER BY
        t.g_score DESC,
        t.g_is_safe DESC,
        vc.n DESC,
        t.g_display_name;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions;
