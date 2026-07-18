-- ============================================================
-- fuzzy_search_foods: add the canine columns to the return set.
-- The original signature predates PawPlate, so search results never
-- carried is_safe_for_dogs / toxicity_note (the UI's unsafe-ingredient
-- warning could not fire from search) or preparation_state (raw/cooked
-- badge). Return-type changes require dropping the function first.
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
        f.is_verified DESC,
        f.name
    LIMIT match_limit;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions;
