-- ============================================================
-- USDA metadata columns + soft-delete flag on `foods`.
-- Phase 1 of docs/DATA_NORMALIZATION_DESIGN.md §3.4 / §3.2.
--
-- WHY usda_data_type / food_category:
--   The bulk importer (scripts/022) discarded FDC's `dataType` and
--   `foodCategory` at import time, so the coverage audit can't report a
--   per-type split and dedupe has no way to prefer Foundation (better
--   micronutrient coverage) over SR Legacy. Both fields are already archived
--   verbatim in `source_payloads`, so this is a BACKFILL FROM STORED JSON —
--   no FDC re-fetch, no API budget spent.
--
-- WHY is_active (soft delete):
--   `meal_items.food_id` and `recipe_ingredients.food_id` are both
--   `REFERENCES public.foods(id) ON DELETE CASCADE NOT NULL`. Hard-deleting a
--   catalogue row therefore silently destroys owners' logged meals and saved
--   recipes — no error, no warning. Category pruning (§3.2) and duplicate
--   merging (§3.3) both need to remove rows from search, so they flip
--   is_active instead of deleting. Reversible, and no user data can be lost.
--
-- Idempotent — safe to re-apply.
-- ============================================================

ALTER TABLE public.foods
    -- 'Foundation' | 'SR Legacy' | NULL (curated/manual/branded rows)
    ADD COLUMN IF NOT EXISTS usda_data_type TEXT,
    -- FDC foodCategory.description, e.g. 'Legumes and Legume Products'
    ADD COLUMN IF NOT EXISTS food_category TEXT,
    -- FALSE hides the row from search without deleting it. NOT NULL so query
    -- authors can't accidentally get three-valued logic on the hot path.
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
    -- Why the row was deactivated, for auditability ('leaked_category',
    -- 'duplicate_of:<uuid>', ...). NULL whenever is_active is TRUE.
    ADD COLUMN IF NOT EXISTS inactive_reason TEXT;

-- Backfill both metadata columns from the archived FDC detail payloads.
-- foodCategory is an OBJECT in format=full detail responses
-- ({id, code, description}) but a bare STRING in search responses, so accept
-- either shape.
UPDATE public.foods f
SET usda_data_type = sp.payload->>'dataType',
    food_category  = COALESCE(
        sp.payload->'foodCategory'->>'description',
        sp.payload->>'foodCategory'
    )
FROM public.source_payloads sp
WHERE sp.source = 'usda'
  AND sp.kind = 'detail'
  AND sp.external_id = f.fdc_id::TEXT
  AND f.fdc_id IS NOT NULL
  AND (f.usda_data_type IS NULL OR f.food_category IS NULL);

CREATE INDEX IF NOT EXISTS foods_food_category_idx
    ON public.foods(food_category)
    WHERE food_category IS NOT NULL;

-- Search and pickers filter on is_active; the vast majority of rows are
-- active, so index only the exceptions.
CREATE INDEX IF NOT EXISTS foods_inactive_idx
    ON public.foods(id)
    WHERE is_active = FALSE;

-- Keep inactive_reason honest: it may only be set on deactivated rows.
ALTER TABLE public.foods DROP CONSTRAINT IF EXISTS foods_inactive_reason_check;
ALTER TABLE public.foods
    ADD CONSTRAINT foods_inactive_reason_check
    CHECK (is_active = TRUE AND inactive_reason IS NULL
        OR is_active = FALSE);
