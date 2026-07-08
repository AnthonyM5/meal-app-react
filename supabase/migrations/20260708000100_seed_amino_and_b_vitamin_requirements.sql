-- ============================================================
-- Seed: AAFCO 2016 requirements for the amino acids and B-vitamins added
-- in 20260708000000 (per 1000 kcal ME), companion to
-- scripts/011_seed_nutrient_requirements.sql / 20260706000100.
--
-- !! SCIENTIFIC BACKBONE — REQUIRES REVIEW !!
-- Same caveat as the original seed: transcribed values, must be verified
-- against the primary AAFCO 2016 Official Publication by a veterinary
-- professional before any production claim is made.
--
-- B-vitamin minimums are published by AAFCO as the same value for both
-- adult maintenance and growth/reproduction; amino acids differ by stage.
-- Idempotent — clears previously seeded rows for these keys first.
-- ============================================================

DELETE FROM public.nutrient_requirements
WHERE nutrient_key IN (
    'threonine_mg', 'isoleucine_mg', 'leucine_mg', 'valine_mg',
    'arginine_mg', 'histidine_mg', 'phenylalanine_tyrosine_mg',
    'thiamin_mg', 'riboflavin_mg', 'niacin_mg', 'pantothenic_acid_mg',
    'vitamin_b6_mg'
) AND source IN ('AAFCO 2016');

INSERT INTO public.nutrient_requirements
    (nutrient_key, life_stage, amount_per_1000kcal, unit, min_value, max_value, source, notes)
VALUES
-- ============ ADULT MAINTENANCE — amino acids ============
('arginine_mg',                'adult', 1280.000, 'mg', 1280.000, NULL, 'AAFCO 2016', NULL),
('histidine_mg',                'adult', 480.000,  'mg', 480.000,  NULL, 'AAFCO 2016', NULL),
('isoleucine_mg',                'adult', 950.000,  'mg', 950.000,  NULL, 'AAFCO 2016', NULL),
('leucine_mg',                'adult', 1700.000, 'mg', 1700.000, NULL, 'AAFCO 2016', NULL),
('threonine_mg',                'adult', 1080.000, 'mg', 1080.000, NULL, 'AAFCO 2016', NULL),
('valine_mg',                'adult', 990.000,  'mg', 990.000,  NULL, 'AAFCO 2016', NULL),
('phenylalanine_tyrosine_mg', 'adult', 1300.000, 'mg', 1300.000, NULL, 'AAFCO 2016', NULL),
-- ============ ADULT MAINTENANCE — B vitamins ============
('thiamin_mg',                'adult', 0.560,    'mg', 0.560,    NULL, 'AAFCO 2016', NULL),
('riboflavin_mg',                'adult', 1.320,    'mg', 1.320,    NULL, 'AAFCO 2016', NULL),
('niacin_mg',                'adult', 4.250,    'mg', 4.250,    NULL, 'AAFCO 2016', NULL),
('pantothenic_acid_mg',        'adult', 3.000,    'mg', 3.000,    NULL, 'AAFCO 2016', NULL),
('vitamin_b6_mg',                'adult', 0.380,    'mg', 0.380,    NULL, 'AAFCO 2016', NULL),

-- ============ PUPPY (GROWTH & REPRODUCTION) — amino acids ============
('arginine_mg',                'puppy', 2500.000, 'mg', 2500.000, NULL, 'AAFCO 2016', NULL),
('histidine_mg',                'puppy', 830.000,  'mg', 830.000,  NULL, 'AAFCO 2016', NULL),
('isoleucine_mg',                'puppy', 1530.000, 'mg', 1530.000, NULL, 'AAFCO 2016', NULL),
('leucine_mg',                'puppy', 2710.000, 'mg', 2710.000, NULL, 'AAFCO 2016', NULL),
('threonine_mg',                'puppy', 1700.000, 'mg', 1700.000, NULL, 'AAFCO 2016', NULL),
('valine_mg',                'puppy', 1230.000, 'mg', 1230.000, NULL, 'AAFCO 2016', NULL),
('phenylalanine_tyrosine_mg', 'puppy', 2130.000, 'mg', 2130.000, NULL, 'AAFCO 2016', NULL),
-- ============ PUPPY (GROWTH & REPRODUCTION) — B vitamins (same as adult) ============
('thiamin_mg',                'puppy', 0.560,    'mg', 0.560,    NULL, 'AAFCO 2016', NULL),
('riboflavin_mg',                'puppy', 1.320,    'mg', 1.320,    NULL, 'AAFCO 2016', NULL),
('niacin_mg',                'puppy', 4.250,    'mg', 4.250,    NULL, 'AAFCO 2016', NULL),
('pantothenic_acid_mg',        'puppy', 3.000,    'mg', 3.000,    NULL, 'AAFCO 2016', NULL),
('vitamin_b6_mg',                'puppy', 0.380,    'mg', 0.380,    NULL, 'AAFCO 2016', NULL);
