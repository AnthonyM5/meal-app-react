-- ============================================================
-- Replace the pre-PawPlate search_foods_by_nutrient with a generic,
-- column-driven version covering all canine-tracked nutrients (the old
-- CASE statement only handled 5 human macros/vitamins — no amino acids,
-- fatty acids, or most minerals, so "find foods high in lysine" had no
-- backing query at all).
--
-- Safe against SQL injection: nutrient_column is validated against
-- information_schema before being interpolated with format(%I).
-- ============================================================

DROP FUNCTION IF EXISTS public.search_foods_by_nutrient(TEXT, DECIMAL, INTEGER);

CREATE OR REPLACE FUNCTION search_foods_by_nutrient(
  nutrient_column TEXT,
  min_amount DECIMAL DEFAULT 0,
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  brand TEXT,
  serving_size DECIMAL,
  serving_unit TEXT,
  calories_per_serving DECIMAL,
  protein_g DECIMAL,
  carbs_g DECIMAL,
  fat_g DECIMAL,
  fiber_g DECIMAL,
  is_safe_for_dogs BOOLEAN,
  toxicity_note TEXT,
  preparation_state TEXT,
  is_verified BOOLEAN,
  nutrient_amount DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'foods'
      AND column_name = nutrient_column
      AND data_type IN ('numeric', 'double precision', 'real', 'integer', 'bigint')
  ) THEN
    RAISE EXCEPTION 'Invalid nutrient column: %', nutrient_column;
  END IF;

  RETURN QUERY EXECUTE format(
    'SELECT f.id, f.name, f.brand, f.serving_size, f.serving_unit,
            f.calories_per_serving, f.protein_g, f.carbs_g, f.fat_g, f.fiber_g,
            f.is_safe_for_dogs, f.toxicity_note, f.preparation_state, f.is_verified,
            f.%1$I AS nutrient_amount
     FROM public.foods f
     WHERE f.%1$I >= $1
     ORDER BY f.%1$I DESC, f.is_verified DESC, f.name
     LIMIT $2',
    nutrient_column
  ) USING min_amount, limit_count;
END;
$$;
