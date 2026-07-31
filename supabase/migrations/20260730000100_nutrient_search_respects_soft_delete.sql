-- ============================================================
-- search_foods_by_nutrient: exclude soft-deleted rows.
--
-- Migration 20260729000000 introduced `is_active`, and 20260729000100 taught
-- fuzzy_search_foods to filter on it — but search_foods_by_nutrient was
-- missed. It backs the Foods page's "highest in <nutrient>" browser
-- (/api/foods/nutrient-search), so pruned prepared foods stayed reachable
-- there after scripts/024 hid them everywhere else.
--
-- Observed on prod before this fix: querying fat_g >= 50 still matched
-- margarine, industrial shortening, and salad dressings — all carrying
-- inactive_reason = 'prune:dressing_spread'. Exactly the rows an owner
-- browsing "highest in fat" for their dog should never be shown.
--
-- Deliberately NOT changed: the by-id lookups in /api/foods/[foodId],
-- meal-service, and the bowl hydration path. Those must keep resolving
-- soft-deleted rows, or a meal an owner logged before the prune would stop
-- rendering. Soft delete removes a row from DISCOVERY, not from history.
--
-- Return type unchanged, so no DROP and no client changes.
-- ============================================================

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
     WHERE f.is_active
       AND f.%1$I >= $1
     ORDER BY f.%1$I DESC, f.is_verified DESC, f.name
     LIMIT $2',
    nutrient_column
  ) USING min_amount, limit_count;
END;
$$;
