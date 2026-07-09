-- ============================================================
-- Branded-ingredient support (BRANDED_INGREDIENTS_DESIGN.md §3).
-- Adds provenance + branded-product columns to `foods` so Open Food Facts /
-- FatSecret items can coexist with USDA/curated whole foods, and backfills
-- `source` for existing rows from whether they carry a USDA fdc_id.
--
-- Also drops the DEFAULT 0 on the canine MICRONUTRIENT columns so that a
-- future branded import which omits a nutrient stores NULL ("unreported")
-- rather than a fabricated 0 (the "missing ≠ zero" rule, §6). Existing rows
-- keep their current values; USDA/curated rows legitimately store measured
-- or assumed zeros and are unaffected. Macros (protein/fat/carbs/fiber) and
-- calories keep their defaults — branded products reliably report those.
-- Idempotent — safe to re-apply.
-- ============================================================

ALTER TABLE public.foods
    ADD COLUMN IF NOT EXISTS source TEXT,
    ADD COLUMN IF NOT EXISTS barcode TEXT,
    ADD COLUMN IF NOT EXISTS external_id TEXT,
    ADD COLUMN IF NOT EXISTS source_attribution TEXT,
    ADD COLUMN IF NOT EXISTS is_complete_food BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS data_completeness TEXT;

-- Constrain the enum-like text columns (drop-then-add so re-apply is clean).
ALTER TABLE public.foods DROP CONSTRAINT IF EXISTS foods_source_check;
ALTER TABLE public.foods
    ADD CONSTRAINT foods_source_check
    CHECK (source IS NULL OR source IN ('usda', 'curated', 'off', 'fatsecret', 'manual'));

ALTER TABLE public.foods DROP CONSTRAINT IF EXISTS foods_data_completeness_check;
ALTER TABLE public.foods
    ADD CONSTRAINT foods_data_completeness_check
    CHECK (data_completeness IS NULL OR data_completeness IN ('full', 'macros_only', 'sparse'));

-- Backfill provenance for existing rows: USDA if it has an fdc_id, else curated.
UPDATE public.foods
    SET source = CASE WHEN fdc_id IS NOT NULL THEN 'usda' ELSE 'curated' END
    WHERE source IS NULL;

-- Barcode is the dedupe key for branded products. Partial unique index so
-- the many NULL-barcode whole foods don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS foods_barcode_unique
    ON public.foods (barcode)
    WHERE barcode IS NOT NULL;

-- "Missing ≠ zero": stop coercing unreported micronutrients to 0 on insert.
ALTER TABLE public.foods
    ALTER COLUMN sugar_g DROP DEFAULT,
    ALTER COLUMN sodium_mg DROP DEFAULT,
    ALTER COLUMN cholesterol_mg DROP DEFAULT,
    ALTER COLUMN vitamin_a_mcg DROP DEFAULT,
    ALTER COLUMN vitamin_c_mg DROP DEFAULT,
    ALTER COLUMN vitamin_d_mcg DROP DEFAULT,
    ALTER COLUMN vitamin_e_mg DROP DEFAULT,
    ALTER COLUMN vitamin_b12_mcg DROP DEFAULT,
    ALTER COLUMN calcium_mg DROP DEFAULT,
    ALTER COLUMN iron_mg DROP DEFAULT,
    ALTER COLUMN magnesium_mg DROP DEFAULT,
    ALTER COLUMN potassium_mg DROP DEFAULT,
    ALTER COLUMN zinc_mg DROP DEFAULT,
    ALTER COLUMN selenium_mcg DROP DEFAULT,
    ALTER COLUMN folate_mcg DROP DEFAULT,
    ALTER COLUMN taurine_mg DROP DEFAULT,
    ALTER COLUMN phosphorus_mg DROP DEFAULT,
    ALTER COLUMN omega3_epa_dha_mg DROP DEFAULT,
    ALTER COLUMN omega6_la_mg DROP DEFAULT,
    ALTER COLUMN vitamin_d_iu DROP DEFAULT,
    ALTER COLUMN choline_mg DROP DEFAULT,
    ALTER COLUMN copper_mg DROP DEFAULT,
    ALTER COLUMN manganese_mg DROP DEFAULT,
    ALTER COLUMN iodine_mcg DROP DEFAULT,
    ALTER COLUMN methionine_cystine_mg DROP DEFAULT,
    ALTER COLUMN lysine_mg DROP DEFAULT,
    ALTER COLUMN tryptophan_mg DROP DEFAULT,
    ALTER COLUMN threonine_mg DROP DEFAULT,
    ALTER COLUMN isoleucine_mg DROP DEFAULT,
    ALTER COLUMN leucine_mg DROP DEFAULT,
    ALTER COLUMN valine_mg DROP DEFAULT,
    ALTER COLUMN arginine_mg DROP DEFAULT,
    ALTER COLUMN histidine_mg DROP DEFAULT,
    ALTER COLUMN phenylalanine_tyrosine_mg DROP DEFAULT,
    ALTER COLUMN thiamin_mg DROP DEFAULT,
    ALTER COLUMN riboflavin_mg DROP DEFAULT,
    ALTER COLUMN niacin_mg DROP DEFAULT,
    ALTER COLUMN pantothenic_acid_mg DROP DEFAULT,
    ALTER COLUMN vitamin_b6_mg DROP DEFAULT;
