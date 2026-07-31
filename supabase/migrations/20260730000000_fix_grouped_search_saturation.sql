-- ============================================================
-- Fix: search_canonical_ingredients reintroduced the saturating-score bug.
--
-- Migration 20260729000300 scored groups with
--   GREATEST(similarity(display_name,q), similarity(base_food,q),
--            word_similarity(q, display_name))
--
-- word_similarity() returns 1.0 whenever the query is an exact word extent of
-- the target — which, for short canonical display names, is almost always. So
-- every group tied at 1.000 and the ORDER BY fell through to its tiebreaks
-- (variant_count DESC, display_name). This is the SAME defect that
-- 20260729000100 removed from fuzzy_search_foods; wrapping it in a GREATEST
-- put it straight back.
--
-- Observed on prod before this fix:
--   'orange' -> 1.000 Orange juice chilled            (x4)
--               1.000 Orange juice frozen concentrate (x4)
--               1.000 Orange juice                    (x2)
--               ... "Oranges" nowhere in the top 4, because juice groups
--                   simply had more variants.
--   'banana' -> 1.000 Bananas or banana powder
--               1.000 Pepper banana
--               ... "Bananas" (the fruit) likewise buried.
--
-- THE FIX
-- Score as a blend, and keep word_similarity in the WHERE clause only, where
-- it does useful recall work. Two terms suffice here — unlike raw USDA
-- descriptions, display_name is already normalized and modifier-free, so
-- whole-string similarity is well behaved and needs no brevity correction:
--
--   0.60 * similarity(display_name, q)   the label the owner actually sees
--   0.40 * similarity(base_food,   q)    rewards the base food over a
--                                        compound like "orange juice"
--
-- 'orange' vs the "Oranges" group scores 0.625; vs "Orange juice chilled"
-- roughly 0.39 — the fruit wins, which is the whole point.
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
    SELECT
        c.id,
        c.slug,
        c.display_name,
        c.base_food,
        c.part,
        c.category,
        c.variant_count,
        c.is_safe_for_dogs,
        f.id,
        f.name,
        f.brand,
        f.serving_size,
        f.calories_per_serving,
        f.protein_g,
        f.carbs_g,
        f.fat_g,
        f.fiber_g,
        f.preparation_state,
        f.is_verified,
        f.source,
        f.data_completeness,
        (
              0.60 * similarity(c.display_name, search_query)
            + 0.40 * similarity(c.base_food, search_query)
        )::REAL AS score
    FROM public.canonical_ingredients c
    JOIN public.foods f
      ON f.canonical_id = c.id
     AND f.is_canonical_default
     AND f.is_active
    WHERE
        -- word_similarity stays HERE, for recall: a one-word query against a
        -- multi-word display name has low whole-string similarity, so `%`
        -- alone would drop real matches. It just no longer drives ranking.
        c.display_name % search_query
        OR c.base_food % search_query
        OR search_query <% c.display_name
    ORDER BY
        score DESC,
        c.is_safe_for_dogs DESC,
        c.variant_count DESC,
        c.display_name
    LIMIT match_limit;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions;
