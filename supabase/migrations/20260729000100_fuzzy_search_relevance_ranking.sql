-- ============================================================
-- fuzzy_search_foods: replace the saturating score with a blended relevance
-- score. Phase 0 of docs/DATA_NORMALIZATION_DESIGN.md §3.1.
--
-- THE BUG THIS FIXES
-- ------------------
-- The 20260712000200 migration scored with
--   GREATEST(similarity(name,q), similarity(brand,q), word_similarity(q,name))
-- `word_similarity(q, name)` returns 1.0 whenever the query appears as a word
-- extent ANYWHERE in the name. That was fine at 61 curated rows. After
-- scripts/022 bulk-imported the USDA corpus (5,029 rows of long comma-
-- delimited descriptions) it matches almost everything, so the score
-- saturates at 1.00 and the effective ordering collapses to the final
-- tiebreak — `f.name`, i.e. ALPHABETICAL. Observed on prod 2026-07-29:
--
--   'beef' -> 1.00 "Beans, baked, canned, with beef"          (top hit)
--   'rice' -> 1.00 "Noodles, chinese, cellophane or long rice ..."
--             1.00 "Oil, rice bran"                            (actual rice below both)
--
-- This also silently corrupted bowl auto-resolution: matchLocalIngredient()
-- takes match_limit 1 and accepts anything over MATCH_THRESHOLD, so a photo
-- label of "beef" resolved to baked beans with a "perfect" 1.00 score.
--
-- THE FIX
-- -------
-- word_similarity stays in the WHERE clause, where it is doing useful work
-- (recall: a short label vs a 100-char description has near-zero whole-string
-- similarity, so `%` alone would return nothing). It is demoted to a minor
-- term in the SCORE, and the dominant signals become the ones that actually
-- carry meaning in a USDA description:
--
--   base_sim  (0.50) similarity against the FIRST comma segment — the base
--             food, and by far the strongest signal.
--             'beef' vs "Beef, round, ..."                = 1.00
--             'beef' vs "Beans, baked, canned, with beef"  = 0.11
--   full_sim  (0.20) whole-name trigram similarity. Jaccard is symmetric, so
--             this penalizes over-specified names intrinsically — it is what
--             keeps "Beef, grass-fed, ground, raw" above
--             "Beef, Australian, imported, Wagyu, ..., marble score 9, raw".
--   word_sim  (0.15) retained so typo tolerance ('chiken liver') and
--             single-word bowl labels keep working.
--   head_sim  (0.10) similarity against the first 3 segments joined by
--             spaces — USDA puts the cut/part in segments 2-3, which is what
--             makes multi-word queries like 'chicken breast' rank correctly.
--   brevity   (0.05) a final nudge toward fewer comma segments.
--
-- HOW THE WEIGHTS WERE FITTED
-- ---------------------------
-- Against all 5,029 live rows, with pg_trgm's similarity()/word_similarity()
-- reimplemented offline, over a 5,966-point weight grid and four formula
-- variants (head window 2 vs 3; brevity by segments vs words). Scored on the
-- 18 named expectations in scripts/023_search_relevance_check.ts.
--
--   old saturating score .............. 13/18
--   this formula ...................... 17/18
--   this formula, after §3.2 pruning ... 18/18
--
-- The single unfixable case is 'chicken' -> "Chicken, meatless" (a soy
-- product). NO weighting can fix it: that string genuinely is the closest
-- match to "chicken". It is a corpus problem, not a ranking problem, and
-- scripts/024 removes it along with the rest of the prepared-food leakage.
--
-- Re-fit via scripts/023 and update BOTH places if the corpus changes shape.
--
-- Return type is UNCHANGED from 20260712000200 (no DROP, so the mobile REST
-- clients and /api/foods/unified-search keep working untouched).
-- ============================================================

-- ---------- helpers ----------
-- Kept as separate IMMUTABLE functions so the scoring formula reads as prose
-- and so the relevance harness can call the exact same code the RPC uses
-- rather than reimplementing it.

/** First `segments` comma-delimited parts of a food name, joined by spaces. */
CREATE OR REPLACE FUNCTION public.food_name_head(
    food_name TEXT,
    segments INT DEFAULT 3
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT btrim(
        array_to_string((string_to_array(food_name, ','))[1:segments], ' ')
    );
$$;

/** How many comma-delimited segments a food name has (>= 1). */
CREATE OR REPLACE FUNCTION public.food_name_segments(food_name TEXT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT GREATEST(cardinality(string_to_array(food_name, ',')), 1);
$$;

/**
 * Blended search relevance in [0,1]. Single source of truth for ranking —
 * both fuzzy_search_foods and the relevance harness call this.
 *
 * search_path includes `extensions` because pg_trgm lives there on this
 * project (migration 20250620030200 created it WITH SCHEMA extensions), but
 * older chains may have it in public — listing both resolves either way.
 */
CREATE OR REPLACE FUNCTION public.food_search_score(
    food_name TEXT,
    food_brand TEXT,
    search_query TEXT
)
RETURNS REAL
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, extensions
AS $$
    SELECT (
          0.50 * similarity(split_part(food_name, ',', 1), search_query)
        + 0.20 * GREATEST(
              similarity(food_name, search_query),
              similarity(COALESCE(food_brand, ''), search_query)
          )
        + 0.15 * word_similarity(search_query, food_name)
        + 0.10 * similarity(public.food_name_head(food_name, 3), search_query)
        -- Gentler than 1/segments: discriminates across the 4-13 segment
        -- range where most USDA rows sit, without over-rewarding the 79
        -- single-segment rows. 1 seg = 1.00, 4 = 0.42, 8 = 0.33, 13 = 0.28.
        + 0.05 * (1.0 / (1.0 + ln(public.food_name_segments(food_name))))
    )::REAL;
$$;

-- ---------- the RPC ----------
CREATE OR REPLACE FUNCTION fuzzy_search_foods(
    search_query TEXT,
    match_limit INT DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    brand TEXT,
    serving_size DECIMAL,
    calories_per_serving DECIMAL,
    protein_g DECIMAL,
    carbs_g DECIMAL,
    fat_g DECIMAL,
    fiber_g DECIMAL,
    sugar_g DECIMAL,
    sodium_mg DECIMAL,
    is_safe_for_dogs BOOLEAN,
    toxicity_note TEXT,
    preparation_state TEXT,
    is_verified BOOLEAN,
    source TEXT,
    data_completeness TEXT,
    is_complete_food BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    similarity REAL
) AS $$
BEGIN
    -- Recall floors for the WHERE clause only. Deliberately permissive: the
    -- blended score does the discriminating, so over-filtering here just
    -- loses good answers we could have ranked.
    PERFORM set_limit(0.2);
    PERFORM set_config('pg_trgm.word_similarity_threshold', '0.5', true);

    RETURN QUERY
    SELECT
        f.id,
        f.name,
        f.brand,
        f.serving_size,
        f.calories_per_serving,
        f.protein_g,
        f.carbs_g,
        f.fat_g,
        f.fiber_g,
        f.sugar_g,
        f.sodium_mg,
        f.is_safe_for_dogs,
        f.toxicity_note,
        f.preparation_state,
        f.is_verified,
        f.source,
        f.data_completeness,
        f.is_complete_food,
        f.created_at,
        f.updated_at,
        public.food_search_score(f.name, f.brand, search_query) AS similarity
    FROM
        public.foods f
    WHERE
        -- Soft-deleted rows (leaked categories, merged duplicates) are gone
        -- from search but still resolvable by id, so historical meal_items
        -- that reference them keep rendering.
        f.is_active
        AND (
            f.name % search_query
            OR f.brand % search_query
            OR search_query <% f.name
        )
    ORDER BY
        similarity DESC,
        -- Trusted whole-food sources outrank branded/manual at a tie.
        (f.source IN ('usda', 'curated')) DESC NULLS LAST,
        -- Foundation carries better micronutrient coverage than SR Legacy.
        (f.usda_data_type = 'Foundation') DESC NULLS LAST,
        f.is_safe_for_dogs DESC,
        f.is_verified DESC,
        f.name
    LIMIT match_limit;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions;
