-- Drop the function if it exists to allow for signature changes
DROP FUNCTION IF EXISTS public.fuzzy_search_foods(TEXT, INT);

-- Enable the pg_trgm extension for fuzzy string matching
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Create a GIN index on the name and brand columns for faster trigram searches.
-- This index is optimized for full-text search and trigram matching.
CREATE INDEX IF NOT EXISTS foods_name_brand_trgm_idx ON public.foods USING gin (name gin_trgm_ops, brand gin_trgm_ops);

-- Create or replace the search function to use trigram similarity
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
    is_verified BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    similarity REAL
) AS $$
BEGIN
    -- Set a threshold for trigram similarity. A lower value is more lenient.
    PERFORM set_limit(0.3);

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
-- Set the search path so the function can find