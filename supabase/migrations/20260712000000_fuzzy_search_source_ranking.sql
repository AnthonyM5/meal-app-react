-- ============================================================
-- fuzzy_search_foods: expose provenance and rank by trust.
--
-- Ahead of the filtered USDA bulk import (thousands of new rows) and the
-- OFF resolve-and-cache tier, search results need two things:
--   1. `source` / `data_completeness` / `is_complete_food` in the return
--      set, so the UI can badge branded/sparse rows and callers can
--      exclude them (they never could before — search returned no
--      provenance).
--   2. Trust-aware ordering: at equal similarity, prefer whole-food
--      (usda/curated) rows over branded, safe rows over toxic, verified
--      over sparse. Unsafe/branded rows are still RETURNED — filtering
--      is the caller's job (the bowl auto-resolver rejects unsafe rows;
--      the picker UI badges them).
--
-- Return-type changes require dropping the function first.
-- ============================================================

DROP FUNCTION IF EXISTS public.fuzzy_search_foods(TEXT, INT);

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
    -- Set a threshold for trigram similarity. A lower value is more lenient.
    PERFORM set_limit(0.2);

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
            similarity(f.brand, search_query)
        ) AS similarity
    FROM
        public.foods f
    WHERE
        -- The "%" operator checks for similarity
        f.name % search_query OR f.brand % search_query
    ORDER BY
        similarity DESC,
        -- Trusted whole-food sources outrank branded/manual at a tie.
        -- NULL source (pre-backfill rows) sorts with the trusted group's
        -- complement — treat only explicit usda/curated as trusted.
        (f.source IN ('usda', 'curated')) DESC NULLS LAST,
        f.is_safe_for_dogs DESC,
        f.is_verified DESC,
        f.name
    LIMIT match_limit;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions;
