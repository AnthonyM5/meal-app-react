-- ============================================================
-- Seed: canine nutrient requirements (per 1000 kcal ME)
--
-- Values transcribed from the AAFCO 2016 Dog Food Nutrient Profiles
-- (per-1000-kcal-ME basis) with NRC 2006 used where AAFCO has no
-- adult value (EPA+DHA). Vitamin A converted IU -> mcg RAE (x0.3).
--
-- !! SCIENTIFIC BACKBONE — REQUIRES REVIEW !!
-- These rows must be verified against the primary sources by a
-- veterinary professional before any production claim is made.
-- Rows carry their source; taurine is informational (dogs have no
-- formal dietary taurine requirement) so amount_per_1000kcal is NULL.
-- ============================================================

-- Idempotent: clear previously seeded reference rows first.
DELETE FROM public.nutrient_requirements
WHERE source IN ('AAFCO 2016', 'NRC 2006', 'PawPlate editorial');

INSERT INTO public.nutrient_requirements
    (nutrient_key, life_stage, amount_per_1000kcal, unit, min_value, max_value, source, notes)
VALUES
-- ============ ADULT MAINTENANCE ============
('protein_g',             'adult', 45.000,   'g',   45.000,   NULL,      'AAFCO 2016', 'Crude protein minimum'),
('fat_g',                 'adult', 13.800,   'g',   13.800,   NULL,      'AAFCO 2016', 'Crude fat minimum'),
('lysine_mg',             'adult', 1580.000, 'mg',  1580.000, NULL,      'AAFCO 2016', NULL),
('methionine_cystine_mg', 'adult', 1630.000, 'mg',  1630.000, NULL,      'AAFCO 2016', NULL),
('tryptophan_mg',         'adult', 400.000,  'mg',  400.000,  NULL,      'AAFCO 2016', NULL),
('omega6_la_mg',          'adult', 2800.000, 'mg',  2800.000, NULL,      'AAFCO 2016', 'Linoleic acid'),
('omega3_epa_dha_mg',     'adult', 110.000,  'mg',  110.000,  2800.000,  'NRC 2006',   'EPA+DHA recommended allowance; SUL ~2.8 g/1000 kcal'),
('calcium_mg',            'adult', 1250.000, 'mg',  1250.000, 6250.000,  'AAFCO 2016', 'Max 2.5% DM equivalent; watch Ca:P ratio 1:1–2:1'),
('phosphorus_mg',         'adult', 1000.000, 'mg',  1000.000, 4000.000,  'AAFCO 2016', 'Ca:P ratio must stay 1:1–2:1'),
('potassium_mg',          'adult', 1500.000, 'mg',  1500.000, NULL,      'AAFCO 2016', NULL),
('sodium_mg',             'adult', 200.000,  'mg',  200.000,  NULL,      'AAFCO 2016', NULL),
('magnesium_mg',          'adult', 150.000,  'mg',  150.000,  NULL,      'AAFCO 2016', NULL),
('iron_mg',               'adult', 10.000,   'mg',  10.000,   NULL,      'AAFCO 2016', NULL),
('copper_mg',             'adult', 1.830,    'mg',  1.830,    NULL,      'AAFCO 2016', NULL),
('manganese_mg',          'adult', 1.250,    'mg',  1.250,    NULL,      'AAFCO 2016', NULL),
('zinc_mg',               'adult', 20.000,   'mg',  20.000,   NULL,      'AAFCO 2016', NULL),
('iodine_mcg',            'adult', 250.000,  'mcg', 250.000,  2750.000,  'AAFCO 2016', 'Max 11 mg/kg DM equivalent'),
('selenium_mcg',          'adult', 80.000,   'mcg', 80.000,   500.000,   'AAFCO 2016', NULL),
('vitamin_a_mcg',         'adult', 375.000,  'mcg', 375.000,  18750.000, 'AAFCO 2016', '1250 IU min / 62500 IU max, converted at 0.3 mcg RAE per IU'),
('vitamin_d_iu',          'adult', 125.000,  'IU',  125.000,  750.000,   'AAFCO 2016', 'Narrow safety margin — excess is toxic'),
('vitamin_e_mg',          'adult', 12.500,   'mg',  12.500,   NULL,      'AAFCO 2016', '12.5 IU; mg approximated 1:1 (synthetic form)'),
('vitamin_b12_mcg',       'adult', 7.000,    'mcg', 7.000,    NULL,      'AAFCO 2016', NULL),
('folate_mcg',            'adult', 54.000,   'mcg', 54.000,   NULL,      'AAFCO 2016', NULL),
('choline_mg',            'adult', 340.000,  'mg',  340.000,  NULL,      'AAFCO 2016', NULL),
('taurine_mg',            'adult', NULL,     'mg',  NULL,     NULL,      'PawPlate editorial', 'No formal canine RDA (dogs synthesize taurine); tracked for DCM-adjacent monitoring in fresh-fed dogs'),

-- ============ PUPPY (GROWTH & REPRODUCTION) ============
('protein_g',             'puppy', 56.300,   'g',   56.300,   NULL,      'AAFCO 2016', 'Crude protein minimum, growth & reproduction'),
('fat_g',                 'puppy', 21.300,   'g',   21.300,   NULL,      'AAFCO 2016', 'Crude fat minimum, growth & reproduction'),
('lysine_mg',             'puppy', 2200.000, 'mg',  2200.000, NULL,      'AAFCO 2016', NULL),
('methionine_cystine_mg', 'puppy', 1750.000, 'mg',  1750.000, NULL,      'AAFCO 2016', NULL),
('tryptophan_mg',         'puppy', 500.000,  'mg',  500.000,  NULL,      'AAFCO 2016', NULL),
('omega6_la_mg',          'puppy', 3300.000, 'mg',  3300.000, NULL,      'AAFCO 2016', 'Linoleic acid'),
('omega3_epa_dha_mg',     'puppy', 130.000,  'mg',  130.000,  2800.000,  'AAFCO 2016', 'EPA+DHA required for growth'),
('calcium_mg',            'puppy', 3000.000, 'mg',  3000.000, 4500.000,  'AAFCO 2016', 'Max 1.8% DM equivalent for large-breed growth — critical'),
('phosphorus_mg',         'puppy', 2500.000, 'mg',  2500.000, 4000.000,  'AAFCO 2016', 'Ca:P ratio must stay 1:1–2:1'),
('potassium_mg',          'puppy', 1500.000, 'mg',  1500.000, NULL,      'AAFCO 2016', NULL),
('sodium_mg',             'puppy', 800.000,  'mg',  800.000,  NULL,      'AAFCO 2016', NULL),
('magnesium_mg',          'puppy', 140.000,  'mg',  140.000,  NULL,      'AAFCO 2016', NULL),
('iron_mg',               'puppy', 22.000,   'mg',  22.000,   NULL,      'AAFCO 2016', NULL),
('copper_mg',             'puppy', 3.100,    'mg',  3.100,    NULL,      'AAFCO 2016', NULL),
('manganese_mg',          'puppy', 1.800,    'mg',  1.800,    NULL,      'AAFCO 2016', NULL),
('zinc_mg',               'puppy', 25.000,   'mg',  25.000,   NULL,      'AAFCO 2016', NULL),
('iodine_mcg',            'puppy', 250.000,  'mcg', 250.000,  2750.000,  'AAFCO 2016', NULL),
('selenium_mcg',          'puppy', 90.000,   'mcg', 90.000,   500.000,   'AAFCO 2016', NULL),
('vitamin_a_mcg',         'puppy', 375.000,  'mcg', 375.000,  18750.000, 'AAFCO 2016', 'Converted at 0.3 mcg RAE per IU'),
('vitamin_d_iu',          'puppy', 125.000,  'IU',  125.000,  750.000,   'AAFCO 2016', 'Narrow safety margin — excess is toxic'),
('vitamin_e_mg',          'puppy', 12.500,   'mg',  12.500,   NULL,      'AAFCO 2016', '12.5 IU; mg approximated 1:1 (synthetic form)'),
('vitamin_b12_mcg',       'puppy', 7.000,    'mcg', 7.000,    NULL,      'AAFCO 2016', NULL),
('folate_mcg',            'puppy', 54.000,   'mcg', 54.000,   NULL,      'AAFCO 2016', NULL),
('choline_mg',            'puppy', 340.000,  'mg',  340.000,  NULL,      'AAFCO 2016', NULL),
('taurine_mg',            'puppy', NULL,     'mg',  NULL,     NULL,      'PawPlate editorial', 'No formal canine RDA; tracked for monitoring');
