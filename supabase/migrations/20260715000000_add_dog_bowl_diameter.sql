-- Fixed-bowl calibration for photo portion estimation (see
-- VISION_MODELS_AND_ESTIMATION.md §2.1/2.2): the owner measures their dog's
-- bowl inner diameter once; every subsequent bowl photo then has a known-size
-- circular reference object in frame, and the vision pipeline can convert
-- the model's bounding boxes into real-world areas → volumes → gram
-- estimates deterministically. Nullable — estimation degrades gracefully to
-- coin/card reference objects, or no estimate at all.
ALTER TABLE public.dogs
  ADD COLUMN IF NOT EXISTS bowl_diameter_cm NUMERIC(5,1)
  CHECK (bowl_diameter_cm IS NULL OR bowl_diameter_cm > 0);

COMMENT ON COLUMN public.dogs.bowl_diameter_cm IS
  'Inner diameter of this dog''s usual food bowl, in cm. Used as the scale reference for photo portion estimates; never affects nutrient math directly.';
