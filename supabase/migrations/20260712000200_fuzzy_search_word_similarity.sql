-- ============================================================
-- fuzzy_search_foods: score with word_similarity as well as whole-string
-- similarity.
--
-- Post bulk-import, food names are long USDA descriptions ("Pasta, cooked,
-- enriched, without added salt"). Whole-string trigram similarity of a
-- short bowl label against those is systematically depressed —
-- similarity('macaroni', 'Macaroni, vegetable, enriched, cooked') = 0.28,
-- under the bowl auto-match floor of 0.3 — so single-word labels stopped
-- resolving. word_similarity() scores the best-matching word extent
-- instead (= 1.0 for that pair). Score = GREATEST of both metrics across
-- name and brand; the WHERE clause gains the word-similarity operator
-- (%>) so those matches are actually returned.
--
-- Return type is unchanged from 20260712000000 (no DROP needed).
-- ============================================================

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
    -- Trigram floors: whole-string (%) and word (%>) operators.
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
        GREATEST(
            similarity(f.name, search_query),
            similarity(f.brand, search_query),
            word_similarity(search_query, f.name)
        ) AS similarity
    FROM
        public.foods f
    WHERE
        f.name % search_query
        OR f.brand % search_query
        OR search_query <% f.name
    ORDER BY
        similarity DESC,
        (f.source IN ('usda', 'curated')) DESC NULLS LAST,
        f.is_safe_for_dogs DESC,
        f.is_verified DESC,
        f.name
    LIMIT match_limit;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions;
