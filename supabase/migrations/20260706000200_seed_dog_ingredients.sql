-- ============================================================
-- Seed: common fresh-feeding dog ingredients (per 100 g)
--
-- Nutrient values are approximate, taken from USDA FoodData Central
-- (Foundation / SR Legacy) entries; taurine and EPA+DHA values come
-- from veterinary/food-science literature where USDA lacks them.
-- Rows with incomplete micronutrient profiles are is_verified = FALSE
-- so the UI can show "incomplete profile".
--
-- Toxic ingredients are seeded ON PURPOSE with is_safe_for_dogs = FALSE
-- so the safety layer has data to warn against.
-- ============================================================

-- Idempotent: remove previously seeded PawPlate rows.
DELETE FROM public.foods WHERE brand = 'PawPlate Seed';

INSERT INTO public.foods
    (name, brand, serving_size, serving_unit, calories_per_serving,
     protein_g, carbs_g, fat_g, fiber_g,
     calcium_mg, phosphorus_mg, potassium_mg, sodium_mg, magnesium_mg,
     iron_mg, zinc_mg, copper_mg, manganese_mg, selenium_mcg, iodine_mcg,
     vitamin_a_mcg, vitamin_d_iu, vitamin_e_mg, vitamin_b12_mcg, folate_mcg,
     choline_mg, taurine_mg, omega3_epa_dha_mg, omega6_la_mg,
     is_safe_for_dogs, toxicity_note, is_verified)
VALUES
-- ============ MUSCLE MEATS ============
('Chicken thigh, boneless skinless, raw', 'PawPlate Seed', 100, 'g', 121, 19.7, 0, 4.7, 0,   9, 185, 242, 86, 24, 0.9, 1.6, 0.06, 0.02, 22.8, 0,   18, 4, 0.2, 0.6, 4,  59, 80, 30, 800,  TRUE, NULL, FALSE),
('Chicken breast, boneless skinless, raw', 'PawPlate Seed', 100, 'g', 120, 22.5, 0, 2.6, 0,  5, 213, 334, 45, 28, 0.4, 0.7, 0.04, 0.02, 22.8, 0,   9, 1, 0.6, 0.2, 9,  82, 18, 20, 400,  TRUE, NULL, FALSE),
('Turkey, ground, 93% lean, raw', 'PawPlate Seed', 100, 'g', 150, 18.7, 0, 8.3, 0,           20, 193, 249, 69, 23, 1.0, 2.6, 0.10, 0.01, 20.9, 0,  17, 12, 0.1, 1.1, 7, 66, 50, 30, 1600, TRUE, NULL, FALSE),
('Beef, ground, 90% lean, raw', 'PawPlate Seed', 100, 'g', 176, 20.0, 0, 10.0, 0,            12, 178, 315, 66, 19, 2.2, 4.8, 0.06, 0.01, 16.4, 0,  4, 2, 0.2, 2.2, 6,  56, 40, 10, 300,  TRUE, NULL, FALSE),
('Pork tenderloin, raw', 'PawPlate Seed', 100, 'g', 120, 20.9, 0, 3.5, 0,                    5, 243, 399, 52, 27, 1.0, 1.9, 0.09, 0.01, 30.4, 0,   0, 12, 0.2, 0.5, 0,  80, 50, 10, 500,  TRUE, NULL, FALSE),
('Lamb, ground, raw', 'PawPlate Seed', 100, 'g', 282, 16.6, 0, 23.4, 0,                      16, 157, 222, 59, 21, 1.6, 3.4, 0.10, 0.02, 18.8, 0,  0, 2, 0.2, 2.3, 18, 70, 45, 30, 1200, TRUE, NULL, FALSE),

-- ============ ORGAN MEATS ============
('Chicken liver, raw', 'PawPlate Seed', 100, 'g', 119, 16.9, 0.7, 4.8, 0,                    8, 297, 230, 71, 19, 9.0, 2.7, 0.49, 0.26, 54.6, 0,   3296, 6, 0.7, 16.6, 588, 194, 110, 60, 500, TRUE, NULL, TRUE),
('Beef liver, raw', 'PawPlate Seed', 100, 'g', 135, 20.4, 3.9, 3.6, 0,                       5, 387, 313, 69, 18, 4.9, 4.0, 9.76, 0.31, 39.7, 0,   4968, 42, 0.4, 59.3, 290, 333, 45, 30, 300, TRUE, NULL, TRUE),
('Chicken heart, raw', 'PawPlate Seed', 100, 'g', 153, 15.6, 0.7, 9.3, 0,                    12, 177, 176, 74, 15, 5.9, 6.6, 0.35, 0.06, 8.2, 0,   9, 0, 0.2, 7.3, 72,  194, 118, 40, 900, TRUE, NULL, TRUE),
('Beef heart, raw', 'PawPlate Seed', 100, 'g', 112, 17.7, 0.1, 3.9, 0,                       7, 212, 287, 98, 21, 4.3, 1.7, 0.40, 0.03, 21.8, 0,   0, 0, 0.2, 8.6, 3,   170, 65, 20, 300,  TRUE, NULL, TRUE),
('Beef kidney, raw', 'PawPlate Seed', 100, 'g', 99, 17.4, 0.3, 3.1, 0,                       13, 257, 262, 182, 17, 4.6, 1.9, 0.43, 0.14, 141.0, 0, 419, 32, 0.2, 27.5, 98, 513, 25, 30, 200, TRUE, NULL, FALSE),

-- ============ FISH & EGGS ============
('Sardines, canned in water, drained', 'PawPlate Seed', 100, 'g', 208, 24.6, 0, 11.5, 0,     382, 490, 397, 307, 39, 2.9, 1.3, 0.19, 0.11, 52.7, 35, 32, 193, 2.0, 8.9, 10, 75, 147, 1480, 1500, TRUE, NULL, TRUE),
('Salmon, Atlantic, farmed, raw', 'PawPlate Seed', 100, 'g', 208, 20.4, 0, 13.4, 0,          9, 240, 363, 59, 27, 0.3, 0.4, 0.05, 0.01, 24.0, 14,  58, 440, 3.6, 3.2, 26, 79, 94, 2200, 600, TRUE, NULL, TRUE),
('Egg, whole, raw', 'PawPlate Seed', 100, 'g', 143, 12.6, 0.7, 9.5, 0,                       56, 198, 138, 142, 12, 1.8, 1.3, 0.07, 0.03, 30.7, 24, 160, 82, 1.1, 0.9, 47, 294, 5, 60, 1500, TRUE, NULL, TRUE),

-- ============ VEGETABLES & FRUIT ============
('Pumpkin, cooked, mashed', 'PawPlate Seed', 100, 'g', 20, 0.7, 4.9, 0.1, 1.1,               15, 30, 230, 1, 9, 0.6, 0.2, 0.09, 0.09, 0.2, 0,      288, 0, 0.8, 0, 9,   6, 0, 0, 10,     TRUE, NULL, TRUE),
('Sweet potato, cooked, no skin', 'PawPlate Seed', 100, 'g', 76, 1.4, 17.7, 0.1, 2.5,        27, 32, 230, 27, 18, 0.7, 0.2, 0.09, 0.27, 0.2, 0,    787, 0, 0.9, 0, 6,   10, 0, 0, 30,    TRUE, NULL, TRUE),
('Spinach, raw', 'PawPlate Seed', 100, 'g', 23, 2.9, 3.6, 0.4, 2.2,                          99, 49, 558, 79, 79, 2.7, 0.5, 0.13, 0.90, 1.0, 0,    469, 0, 2.0, 0, 194, 19, 0, 0, 30,    TRUE, 'High in oxalates — feed in moderation, avoid for dogs with kidney/bladder stone history', TRUE),
('Broccoli, raw', 'PawPlate Seed', 100, 'g', 34, 2.8, 6.6, 0.4, 2.6,                         47, 66, 316, 33, 21, 0.7, 0.4, 0.05, 0.21, 2.5, 0,    31, 0, 0.8, 0, 63,   19, 0, 0, 20,    TRUE, 'Keep under ~10% of intake — isothiocyanates can cause GI upset in quantity', TRUE),
('Carrot, raw', 'PawPlate Seed', 100, 'g', 41, 0.9, 9.6, 0.2, 2.8,                           33, 35, 320, 69, 12, 0.3, 0.2, 0.05, 0.14, 0.1, 0,    835, 0, 0.7, 0, 19,  9, 0, 0, 60,     TRUE, NULL, TRUE),
('Green beans, cooked', 'PawPlate Seed', 100, 'g', 35, 1.9, 7.9, 0.3, 3.2,                   44, 29, 146, 1, 18, 0.7, 0.3, 0.06, 0.29, 0.2, 0,     32, 0, 0.5, 0, 33,   13, 0, 0, 20,    TRUE, NULL, TRUE),
('Blueberries, raw', 'PawPlate Seed', 100, 'g', 57, 0.7, 14.5, 0.3, 2.4,                     6, 12, 77, 1, 6, 0.3, 0.2, 0.06, 0.34, 0.1, 0,        3, 0, 0.6, 0, 6,    6, 0, 0, 90,     TRUE, NULL, TRUE),
('Apple, raw, cored (no seeds)', 'PawPlate Seed', 100, 'g', 52, 0.3, 13.8, 0.2, 2.4,         6, 11, 107, 1, 5, 0.1, 0.0, 0.03, 0.04, 0.0, 0,       3, 0, 0.2, 0, 3,    3, 0, 0, 40,     TRUE, 'Flesh is safe; seeds and core contain cyanogenic glycosides — always remove', TRUE),

-- ============ GRAINS & DAIRY ============
('Rice, brown, cooked', 'PawPlate Seed', 100, 'g', 112, 2.3, 23.5, 0.8, 1.8,                 10, 77, 79, 1, 44, 0.5, 0.6, 0.10, 0.97, 5.8, 0,      0, 0, 0.2, 0, 9,    9, 0, 0, 300,    TRUE, NULL, TRUE),
('Rice, white, cooked', 'PawPlate Seed', 100, 'g', 130, 2.7, 28.2, 0.3, 0.4,                 10, 43, 35, 1, 12, 1.2, 0.5, 0.07, 0.47, 7.5, 0,      0, 0, 0.0, 0, 58,   2, 0, 0, 100,    TRUE, NULL, TRUE),
('Oatmeal, cooked with water', 'PawPlate Seed', 100, 'g', 71, 2.5, 12.0, 1.5, 1.7,           9, 77, 70, 4, 27, 0.9, 1.0, 0.07, 0.59, 6.1, 0,       0, 0, 0.1, 0, 6,    12, 0, 0, 500,   TRUE, NULL, TRUE),
('Quinoa, cooked', 'PawPlate Seed', 100, 'g', 120, 4.4, 21.3, 1.9, 2.8,                      17, 152, 172, 7, 64, 1.5, 1.1, 0.19, 0.63, 2.8, 0,    0, 0, 0.6, 0, 42,   23, 0, 0, 900,   TRUE, NULL, TRUE),
('Yogurt, plain, whole milk', 'PawPlate Seed', 100, 'g', 61, 3.5, 4.7, 3.3, 0,               121, 95, 155, 46, 12, 0.1, 0.6, 0.01, 0.00, 2.2, 25,  27, 2, 0.1, 0.4, 7,  15, 0, 0, 100,  TRUE, 'Skip for lactose-intolerant dogs; plain unsweetened only (no xylitol)', TRUE),
('Cottage cheese, 2% fat', 'PawPlate Seed', 100, 'g', 84, 11.0, 4.3, 2.3, 0,                 91, 150, 104, 321, 9, 0.1, 0.5, 0.03, 0.00, 11.9, 26, 23, 1, 0.0, 0.5, 9,  17, 0, 0, 100,  TRUE, 'Higher sodium — moderate for cardiac/renal dogs', TRUE),

-- ============ FRESH-FEEDING SUPPLEMENTS ============
('Eggshell powder (calcium supplement)', 'PawPlate Seed', 100, 'g', 0, 0, 0, 0, 0,           38000, 150, 0, 0, 300, 0, 0, 0.00, 0.00, 0, 0,        0, 0, 0, 0, 0,      0, 0, 0, 0,      TRUE, 'Pure calcium source (~380 mg Ca per gram) — dose carefully, excess calcium is harmful especially for puppies', TRUE),
('Kelp powder (iodine supplement)', 'PawPlate Seed', 100, 'g', 43, 1.7, 9.6, 0.6, 1.3,       168, 42, 89, 233, 121, 2.9, 1.2, 0.13, 0.20, 0.7, 150000, 6, 0, 0.9, 0, 180, 13, 0, 0, 20, TRUE, 'Iodine content varies wildly by product — verify label; overdose suppresses thyroid', FALSE),
('Salmon oil', 'PawPlate Seed', 100, 'g', 902, 0, 0, 100, 0,                                 0, 0, 0, 0, 0, 0, 0, 0.00, 0.00, 0, 0,               0, 0, 0, 0, 0,      0, 0, 30000, 1500, TRUE, 'Fat supplement — account for calories; store cold to prevent rancidity', TRUE),

-- ============ TOXIC — SEEDED FOR THE SAFETY LAYER ============
('Onion, raw', 'PawPlate Seed', 100, 'g', 40, 1.1, 9.3, 0.1, 1.7,                            23, 29, 146, 4, 10, 0.2, 0.2, 0.04, 0.13, 0.5, 0,     0, 0, 0.0, 0, 19,   6, 0, 0, 10,     FALSE, 'TOXIC: organosulfoxides cause Heinz-body hemolytic anemia in dogs; all forms (raw, cooked, powdered) are dangerous', TRUE),
('Garlic, raw', 'PawPlate Seed', 100, 'g', 149, 6.4, 33.1, 0.5, 2.1,                         181, 153, 401, 17, 25, 1.7, 1.2, 0.30, 1.67, 14.2, 0, 0, 0, 0.0, 0, 3,    23, 0, 0, 200,   FALSE, 'TOXIC: more concentrated organosulfoxides than onion; causes hemolytic anemia', TRUE),
('Grapes, raw', 'PawPlate Seed', 100, 'g', 69, 0.7, 18.1, 0.2, 0.9,                          10, 20, 191, 2, 7, 0.4, 0.1, 0.13, 0.07, 0.1, 0,      3, 0, 0.2, 0, 2,    6, 0, 0, 30,     FALSE, 'TOXIC: causes acute kidney injury in dogs (tartaric acid suspected); no safe dose established', TRUE),
('Raisins', 'PawPlate Seed', 100, 'g', 299, 3.1, 79.2, 0.5, 3.7,                             50, 101, 749, 11, 32, 1.9, 0.2, 0.32, 0.30, 0.6, 0,   0, 0, 0.1, 0, 5,    11, 0, 0, 30,    FALSE, 'TOXIC: concentrated grape toxicity — acute kidney injury; no safe dose established', TRUE),
('Chocolate, dark, 70-85% cacao', 'PawPlate Seed', 100, 'g', 598, 7.8, 45.9, 42.6, 10.9,     73, 308, 715, 20, 228, 11.9, 3.3, 1.77, 1.95, 6.8, 0, 2, 0, 0.6, 0.3, 0,  46, 0, 0, 1100, FALSE, 'TOXIC: theobromine and caffeine — dogs metabolize theobromine slowly; dark chocolate is the most dangerous common form', TRUE),
('Macadamia nuts', 'PawPlate Seed', 100, 'g', 718, 7.9, 13.8, 75.8, 8.6,                     85, 188, 368, 5, 130, 3.7, 1.3, 0.76, 4.13, 3.6, 0,   0, 0, 0.5, 0, 11,   45, 0, 0, 1300, FALSE, 'TOXIC: causes weakness, tremors, hyperthermia in dogs; mechanism unknown', TRUE),
('Xylitol (sweetener)', 'PawPlate Seed', 100, 'g', 240, 0, 100, 0, 0,                        0, 0, 0, 0, 0, 0, 0, 0.00, 0.00, 0, 0,               0, 0, 0, 0, 0,      0, 0, 0, 0,      FALSE, 'TOXIC: triggers massive insulin release causing hypoglycemia, then hepatic necrosis; tiny amounts can be fatal', TRUE);
