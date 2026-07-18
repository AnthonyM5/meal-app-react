-- ============================================================
-- preparation_state on foods: distinguishes raw vs cooked entries
-- so both variants of an ingredient can coexist (per-100g values
-- differ materially: water loss concentrates nutrients, and heat
-- degrades B-vitamins / leaches minerals). Values always describe
-- the food AS FED — no raw→cooked conversion happens in the app.
-- NULL = unknown/not applicable (e.g. supplements).
-- ============================================================

ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS preparation_state TEXT
  CHECK (preparation_state IN ('raw', 'cooked'));

-- Backfill from USDA-style names. 'raw' as a whole word first, then the
-- cooking methods; anything ambiguous stays NULL.
UPDATE public.foods
SET preparation_state = 'raw'
WHERE preparation_state IS NULL
  AND name ~* '\mraw\M';

UPDATE public.foods
SET preparation_state = 'cooked'
WHERE preparation_state IS NULL
  AND name ~* 'cooked|roasted|stewed|fried|boiled|grilled|baked|braised|poached|steamed|rotisserie|hard-boiled|scrambled';
