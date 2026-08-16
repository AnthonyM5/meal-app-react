# Zero-calorie food backfill

Generated 2026-08-05T17:07:45.815Z by `scripts/029_backfill_zero_calorie_foods.ts` (APPLIED).

Foundation foods report energy under FDC nutrients 2047/2048, never 1008. The importer read 1008 only, so every Foundation row landed at 0 kcal.

| outcome | rows |
|---|---:|
| repaired from a stored energy nutrient | 195 |
| derived from macros (4/4/9) | 31 |
| empty shell — no energy, no macros | 18 |
| no stored payload | 1 |
| **total** | **245** |

47 of these are the DEFAULT variant of a canonical group — the row the variant picker shows first.

## Repaired

`via` records which FDC nutrient supplied the answer. Values from 1008 / 2047 / 2048 are USDA-measured. Values marked **derived 4/4/9** are computed from macros and are approximations — for "Butter, stick, salted" that gives 740 against a published 717 (+3%), because general Atwater factors overestimate pure fats. That is a rounding error next to the -100% these rows carried before, but it is not a measured value.

| food | kcal/100g | via | group default |
|---|---:|---|:---:|
| Butter, stick, salted | 740 | derived 4/4/9 | yes |
| Butter, stick, unsalted | 734 | derived 4/4/9 |  |
| Nuts, pecans, halves, raw | 700 | 2048 (Atwater specific) |  |
| Nuts, walnuts, English, halves, raw | 679 | 2048 (Atwater specific) |  |
| Sesame butter, creamy | 648 | 2048 (Atwater specific) | yes |
| Nuts, pine nuts, raw | 643 | 2048 (Atwater specific) | yes |
| Nuts, brazilnuts, raw | 621 | 2048 (Atwater specific) |  |
| Almond butter, creamy | 603 | 2048 (Atwater specific) | yes |
| Nuts, hazelnuts or filberts, raw | 602 | 2048 (Atwater specific) |  |
| Peanut butter, creamy | 589 | 2048 (Atwater specific) | yes |
| Nuts, almonds, whole, raw | 584 | 2048 (Atwater specific) |  |
| Flour, almond | 578 | 2048 (Atwater specific) |  |
| Seeds, sunflower seed, kernel, raw | 571 | 2048 (Atwater specific) |  |
| Peanuts, raw | 551 | 2048 (Atwater specific) |  |
| Seeds, pumpkin seeds (pepitas), raw | 515 | 2048 (Atwater specific) |  |
| Flaxseed, ground | 514 | 2048 (Atwater specific) | yes |
| Chia seeds, dry, raw | 490 | 2048 (Atwater specific) | yes |
| Flour, coconut | 424 | 2048 (Atwater specific) |  |
| Cheese, parmesan, grated, refrigerated | 405 | 2048 (Atwater specific) |  |
| Cheese, monterey jack, solid | 391 | 2048 (Atwater specific) |  |
| Flour, oat, whole grain | 386 | 2048 (Atwater specific) |  |
| Pork, belly, with skin, raw | 385 | 2048 (Atwater specific) |  |
| Flour, chestnut | 385 | 2048 (Atwater specific) |  |
| Millet, whole grain | 381 | 2048 (Atwater specific) |  |
| Oats, whole grain, steel cut | 379 | 2048 (Atwater specific) |  |
| Oats, whole grain, rolled, old fashioned | 379 | 2048 (Atwater specific) |  |
| Flour, quinoa | 378 | 2048 (Atwater specific) |  |
| Flour, amaranth | 378 | 2048 (Atwater specific) |  |
| Fonio, grain, dry, raw | 377 | 2048 (Atwater specific) | yes |
| Chickpeas, (garbanzo beans, bengal gram), dry | 372 | 2048 (Atwater specific) |  |
| Rice, white, long grain, unenriched, raw | 370 | 2048 (Atwater specific) |  |
| Rice, brown, long grain, unenriched, raw | 368 | 2048 (Atwater specific) |  |
| Corn flour, masa harina, white or yellow, dry, raw | 366 | 2048 (Atwater specific) |  |
| Flour, semolina, fine | 366 | 2048 (Atwater specific) |  |
| Flour, 00 | 366 | 2048 (Atwater specific) |  |
| Flour, semolina, coarse and semi-coarse | 365 | 2048 (Atwater specific) |  |
| Sorghum bran, white, unenriched, dry, raw | 365 | 2048 (Atwater specific) | yes |
| Flour, sorghum | 364 | 2048 (Atwater specific) |  |
| Rice, black, unenriched, raw | 361 | 2048 (Atwater specific) |  |
| Rice, red, unenriched, dry, raw | 360 | 2048 (Atwater specific) |  |
| Flour, cassava | 359 | 2048 (Atwater specific) |  |
| Wild rice, dry, raw | 359 | 2048 (Atwater specific) |  |
| Flour, barley | 357 | 2048 (Atwater specific) |  |
| Cheese, provolone, sliced | 357 | 2048 (Atwater specific) |  |
| Flour, potato | 353 | 2048 (Atwater specific) |  |
| Cheese, cotija, solid | 352 | 2048 (Atwater specific) |  |
| Flour, rye | 351 | 2048 (Atwater specific) |  |
| Lentils, dry | 351 | 2048 (Atwater specific) |  |
| Sorghum flour, white, pearled, unenriched, dry, raw | 350 | 2048 (Atwater specific) | yes |
| Bulgur, dry, raw | 349 | 2048 (Atwater specific) |  |
| Khorasan, grain, dry, raw | 348 | 2048 (Atwater specific) | yes |
| Einkorn, grain, dry, raw | 346 | 2048 (Atwater specific) | yes |
| Blackeye pea, dry | 346 | 2048 (Atwater specific) | yes |
| Farro, pearled, dry, raw | 344 | 2048 (Atwater specific) | yes |
| Sorghum, whole grain, white, dry, raw | 341 | 2048 (Atwater specific) | yes |
| Flour, spelt, whole grain | 341 | 2048 (Atwater specific) |  |
| Sorghum grain, white, pearled, unenriched, dry, raw | 338 | 2048 (Atwater specific) | yes |
| Cream cheese, full fat, block | 337 | 2048 (Atwater specific) | yes |
| Beans, cannellini, dry | 337 | 2048 (Atwater specific) |  |
| Cream, heavy | 336 | 2048 (Atwater specific) |  |
| Flour, buckwheat | 334 | 2048 (Atwater specific) |  |
| Buckwheat, whole grain | 332 | 2048 (Atwater specific) |  |
| Cheese, pasteurized process cheese food or product, American, singles | 308 | 2048 (Atwater specific) |  |
| Cheese, oaxaca, solid | 298 | 2048 (Atwater specific) |  |
| Cheese, queso fresco, solid | 297 | 2048 (Atwater specific) |  |
| Cheese, feta, whole milk, crumbled | 273 | 2048 (Atwater specific) | yes |
| Beef, ribeye, steak, boneless, choice, raw | 260 | 2048 (Atwater specific) |  |
| Beef, chuck, roast, boneless, choice, raw | 237 | 2048 (Atwater specific) |  |
| Pork, ground, raw | 233 | 2048 (Atwater specific) |  |
| Sea bass, Chilean, frozen, wild caught | 209 | 2047 (Atwater general) | yes |
| Anchovies, canned in olive oil, with salt, drained | 206 | 2047 (Atwater general) | yes |
| Avocado, Hass, peeled, raw | 206 | 2048 (Atwater specific) |  |
| Fish, salmon, Atlantic, farm raised, raw | 203 | 2048 (Atwater specific) |  |
| Beef, short loin (NY strip steak), raw | 196 | 2048 (Atwater specific) |  |
| Chicken, thigh, meat and skin, raw | 193 | 2048 (Atwater specific) |  |
| Cream, sour, full fat | 193 | 2048 (Atwater specific) | yes |
| Pork, loin, boneless, raw | 174 | 2048 (Atwater specific) |  |
| Chicken, wing, meat and skin, raw | 173 | 2048 (Atwater specific) |  |
| Beef, flank, steak, boneless, choice, raw | 170 | 2048 (Atwater specific) |  |
| Bison, ground, raw | 164 | 2048 (Atwater specific) |  |
| Turkey, ground, 93% lean/ 7% fat, raw | 158 | 2048 (Atwater specific) |  |
| Swordfish, frozen, wild caught | 152 | 2047 (Atwater general) | yes |
| Chicken, thigh, boneless, skinless, raw | 149 | 2048 (Atwater specific) |  |
| Beef, tenderloin steak, raw | 149 | 2048 (Atwater specific) |  |
| Beef, round, top round, boneless, choice, raw | 146 | 2048 (Atwater specific) |  |
| Beef, top sirloin steak, raw | 146 | 2048 (Atwater specific) |  |
| Pork, chop, center cut, raw | 145 | 2048 (Atwater specific) | yes |
| Plantains, underripe, raw | 145 | 2048 (Atwater specific) |  |
| Chicken, ground, with additives, raw | 138 | 2048 (Atwater specific) |  |
| Fish, salmon, sockeye, wild caught, raw | 136 | 2048 (Atwater specific) |  |
| Fish, catfish, farm raised, raw | 134 | 2048 (Atwater specific) |  |
| Chickpeas (garbanzo beans, bengal gram), canned, sodium added, drained and rinsed | 133 | 2048 (Atwater specific) |  |
| Chicken, breast, meat and skin, raw | 133 | 2048 (Atwater specific) |  |
| Chicken, drumstick, meat and skin, raw | 130 | 2048 (Atwater specific) |  |
| Pork, loin, tenderloin, boneless, raw | 125 | 2048 (Atwater specific) |  |
| Beans, kidney, light red, canned, sodium added, sugar added, drained and rinsed | 124 | 2048 (Atwater specific) |  |
| Beans, kidney, dark red, canned, sodium added, sugar added, drained and rinsed | 123 | 2048 (Atwater specific) |  |
| Plantains, ripe, raw | 123 | 2048 (Atwater specific) |  |
| Beans, Dry, Tan (0% moisture) | 117 | derived 4/4/9 |  |
| Plantains, overripe, raw | 117 | 2048 (Atwater specific) |  |
| Beans, navy, canned, sodium added, drained and rinsed | 116 | 2048 (Atwater specific) |  |
| Beans, Dry, Dark Red Kidney (0% moisture) | 115 | derived 4/4/9 |  |
| Beans, black, canned, sodium added, drained and rinsed | 115 | 2048 (Atwater specific) |  |
| Beans, Dry, Carioca (0% moisture) | 114 | derived 4/4/9 |  |
| Beans, great northern, canned, sodium added, drained and rinsed | 114 | 2048 (Atwater specific) |  |
| Beans, pinto, canned, sodium added, drained and rinsed | 114 | 2048 (Atwater specific) |  |
| Blackeye pea, canned, sodium added, drained and rinsed | 113 | 2048 (Atwater specific) |  |
| Beans, Dry, Brown (0% moisture) | 112 | derived 4/4/9 |  |
| Chicken, breast, boneless, skinless, raw | 112 | 2048 (Atwater specific) |  |
| Beans, cannellini, canned, sodium added, drained and rinsed | 112 | 2048 (Atwater specific) |  |
| Beans, Dry, Medium Red (0% moisture) | 111 | derived 4/4/9 |  |
| Beans, Dry, Black (0% moisture) | 111 | derived 4/4/9 |  |
| Beans, Dry, Navy (0% moisture) | 110 | derived 4/4/9 |  |
| Beans, Dry, Great Northern (0% moisture) | 110 | derived 4/4/9 |  |
| Beans, Dry, Light Tan (0% moisture) | 110 | derived 4/4/9 |  |
| Beans, Dry, Small White (0% moisture) | 110 | derived 4/4/9 |  |
| Beans, Dry, Light Red Kidney (0% moisture) | 109 | derived 4/4/9 |  |
| Beans, Dry, Cranberry (0% moisture) | 109 | derived 4/4/9 |  |
| Beans, Dry, Pinto (0% moisture) | 106 | derived 4/4/9 |  |
| Beans, Dry, Small Red (0% moisture) | 106 | derived 4/4/9 |  |
| Cottage cheese, full fat, large or small curd | 105 | 2048 (Atwater specific) | yes |
| Beans, Dry, Pink (0% moisture) | 104 | derived 4/4/9 |  |
| Tuna, ahi or yellowfin, frozen, wild caught | 102 | 2047 (Atwater general) | yes |
| Beans, Dry, Flor de Mayo (0% moisture) | 101 | derived 4/4/9 |  |
| Fish, tilapia, farm raised, raw | 100 | 2048 (Atwater specific) |  |
| Beans, Dry, Red (0% moisture) | 96 | derived 4/4/9 |  |
| Yogurt, Greek, plain, whole milk | 95 | 2048 (Atwater specific) |  |
| Snapper, frozen, wild caught | 90 | 2047 (Atwater general) | yes |
| Tomato, paste, canned, without salt added | 89 | 2048 (Atwater specific) |  |
| Crustaceans, crab, blue swimming, lump, pasteurized, refrigerated | 86 | 2048 (Atwater specific) |  |
| Mahi mahi, frozen, wild caught | 84 | 2047 (Atwater general) | yes |
| Halibut, frozen, wild caught | 81 | 2047 (Atwater general) | yes |
| Potatoes, russet, without skin, raw | 81 | 2048 (Atwater specific) |  |
| Alaska Pollock, raw | 78 | 2047 (Atwater general) | yes |
| Scallops, bay, Patagonian, frozen, wild caught | 78 | 2047 (Atwater general) |  |
| Peas, green, sweet, canned, sodium added, sugar added, drained and rinsed | 78 | 2048 (Atwater specific) |  |
| Sweet potatoes, orange flesh, without skin, raw | 77 | 2048 (Atwater specific) |  |
| Yogurt, plain, whole milk | 77 | 2048 (Atwater specific) | yes |
| Grapes, red, seedless, raw | 77 | 2048 (Atwater specific) |  |
| Crustaceans, shrimp, farm raised, raw | 76 | 2048 (Atwater specific) |  |
| Potatoes, red, without skin, raw | 73 | 2048 (Atwater specific) |  |
| Corn, sweet, yellow and white kernels,  fresh, raw | 73 | 2048 (Atwater specific) |  |
| Grapes, green, seedless, raw | 72 | 2048 (Atwater specific) |  |
| Potatoes, gold, without skin, raw | 72 | 2048 (Atwater specific) |  |
| Mango, Ataulfo, peeled, raw | 71 | 2048 (Atwater specific) |  |
| Fish, cod, Atlantic, wild caught, raw | 70 | 2048 (Atwater specific) |  |
| Snow crab, legs only, frozen   | 69 | 2047 (Atwater general) | yes |
| Scallops, sea, frozen, wild caught | 66 | 2047 (Atwater general) | yes |
| Grape juice, white, with added vitamin C, from concentrate, shelf stable | 65 | 2048 (Atwater specific) | yes |
| Grape juice, purple, with added vitamin C, from concentrate, shelf stable | 65 | 2048 (Atwater specific) |  |
| Cherries, sweet, dark red, raw | 63 | 2048 (Atwater specific) |  |
| Mango, Tommy Atkins, peeled, raw | 62 | 2048 (Atwater specific) |  |
| Cod, Pacific or Alaskan, frozen, wild caught | 61 | 2047 (Atwater general) | yes |
| Lobster, tail only, frozen, wild caught | 59 | 2047 (Atwater general) | yes |
| Kiwifruit (kiwi), green, peeled, raw | 58 | 2048 (Atwater specific) |  |
| Apples, fuji, with skin, raw | 58 | 2048 (Atwater specific) |  |
| Pear, Anjou, green, with skin, raw | 57 | 2048 (Atwater specific) |  |
| Mandarin, seedless, peeled, raw | 56 | 2048 (Atwater specific) | yes |
| Apples, red delicious, with skin, raw | 56 | 2048 (Atwater specific) |  |
| Apples, gala, with skin, raw | 55 | 2048 (Atwater specific) |  |
| Pineapple, raw | 54 | 2048 (Atwater specific) |  |
| Apples, honeycrisp, with skin, raw | 54 | 2048 (Atwater specific) |  |
| Apples, granny smith, with skin, raw | 53 | 2048 (Atwater specific) |  |
| Plum, black, with skin, raw | 53 | 2048 (Atwater specific) |  |
| Yogurt, plain, nonfat | 50 | 2048 (Atwater specific) |  |
| Apple juice, with added vitamin C, from concentrate, shelf stable | 47 | 2048 (Atwater specific) |  |
| Applesauce, unsweetened, with added vitamin C | 46 | 2048 (Atwater specific) |  |
| Orange juice, no pulp, not fortified, from concentrate, refrigerated | 46 | 2048 (Atwater specific) |  |
| Carrots, mature, raw | 45 | 2048 (Atwater specific) |  |
| Orange juice, no pulp, not fortified, not from concentrate, refrigerated | 45 | 2048 (Atwater specific) |  |
| Squid (calamari), frozen, tubes only | 44 | 2047 (Atwater general) | yes |
| Apricot, with skin, raw | 43 | 2048 (Atwater specific) |  |
| Buttermilk, low fat | 43 | 2048 (Atwater specific) | yes |
| Soy milk, sweetened, plain, refrigerated | 41 | 2047 (Atwater general) | yes |
| Grapefruit juice, red, not fortified, not from concentrate, refrigerated | 40 | 2048 (Atwater specific) |  |
| Soy milk, unsweetened, plain, shelf stable | 38 | 2048 (Atwater specific) |  |
| Mushroom, king oyster | 38 | 2048 (Atwater specific) |  |
| Mushroom, enoki | 37 | 2048 (Atwater specific) |  |
| Mushrooms, shiitake | 36 | 2048 (Atwater specific) |  |
| Mushroom, lion's mane | 35 | 2048 (Atwater specific) |  |
| Tomato, puree, canned | 35 | 2048 (Atwater specific) |  |
| Mushroom, oyster | 33 | 2048 (Atwater specific) |  |
| Mushroom, beech | 33 | 2048 (Atwater specific) | yes |
| Cranberry juice, not fortified, from concentrate, shelf stable | 31 | 2048 (Atwater specific) |  |
| Mushroom, pioppini | 31 | 2048 (Atwater specific) |  |
| Mushroom, maitake | 31 | 2048 (Atwater specific) |  |
| Peppers, serrano, seeded, raw | 29 | 2047 (Atwater general) |  |
| Peppers, poblano, seeded, raw | 28 | 2047 (Atwater general) |  |
| Cabbage, green, raw | 28 | 2048 (Atwater specific) |  |
| Peppers, bell, orange, raw | 27 | 2048 (Atwater specific) |  |
| Peppers, bell, red, raw | 27 | 2048 (Atwater specific) |  |
| Peppers, bell, yellow, raw | 27 | 2048 (Atwater specific) |  |
| Mushroom, portabella | 26 | 2048 (Atwater specific) |  |
| Arugula, baby, raw | 26 | 2048 (Atwater specific) |  |
| Mushrooms, white button | 25 | 2048 (Atwater specific) | yes |
| Peppers, jalapeno, seeded, raw | 24 | 2047 (Atwater general) |  |
| Peppers, banana or Hungarian wax, seeded, raw | 24 | 2047 (Atwater general) |  |
| Mushroom, crimini | 24 | 2048 (Atwater specific) |  |
| Asparagus, green, raw | 24 | 2048 (Atwater specific) |  |
| Spinach, mature | 22 | 2048 (Atwater specific) |  |
| Spinach, baby | 21 | 2048 (Atwater specific) | yes |
| Tomato juice, with added ingredients, from concentrate, shelf stable | 20 | 2048 (Atwater specific) |  |
| Peppers, bell, green, raw | 20 | 2048 (Atwater specific) |  |
| Radishes, red, raw | 20 | 2047 (Atwater general) |  |
| Watermelon, seedless, rind only, raw | 19 | 2047 (Atwater general) |  |
| Tomatoes, whole, canned, solids and liquids, with salt added | 19 | 2048 (Atwater specific) |  |
| Squash, summer, yellow, includes skin, raw | 19 | 2048 (Atwater specific) |  |
| Tomato, roma | 19 | 2048 (Atwater specific) | yes |
| Lettuce, leaf, green, raw | 18 | 2048 (Atwater specific) |  |
| Lettuce, romaine, green, raw | 17 | 2048 (Atwater specific) |  |
| Cabbage, bok choy, raw | 17 | 2048 (Atwater specific) |  |
| Squash, summer, green, zucchini, includes skin, raw | 16 | 2048 (Atwater specific) |  |
| Lettuce, leaf, red, raw | 15 | 2048 (Atwater specific) |  |
| Lettuce, iceberg, raw | 14 | 2048 (Atwater specific) |  |
| Leeks, bulb and greens, root removed, raw | 6 | derived 4/4/9 |  |
| Shallots, bulb, peeled, root removed, raw | 6 | derived 4/4/9 |  |
| Pawpaw, peeled, seeded, raw | 5 | derived 4/4/9 | yes |
| Cabbage, napa, leaf, destemmed, raw | 4 | derived 4/4/9 |  |
| Tomatillos, dehusked, raw | 4 | derived 4/4/9 |  |
| Rutabaga, peeled, raw | 4 | derived 4/4/9 |  |
| Watermelon, seedless, flesh only, raw | 3 | derived 4/4/9 |  |
| Squash, pie pumpkin, peeled, seeded, raw | 3 | derived 4/4/9 |  |
| Squash, spaghetti, peeled, seeded, raw | 3 | derived 4/4/9 |  |
| Green onion, (scallion), bulb and greens, root removed, raw | 3 | derived 4/4/9 | yes |
| Juice, prune, shelf-stable | 2 | derived 4/4/9 |  |
| Juice, tart cherry, from concentrate, shelf-stable | 1 | derived 4/4/9 |  |

## Not repairable from stored data

These carry no energy nutrient AND no macros in the payload captured at import. Several are obviously wrong on their face — "Oil, peanut" is 100% fat in reality — so the payload itself is sparse, not the parsing. They need a fresh FDC fetch or manual curation.

| food | fdc_id | protein | fat | carbs | group default |
|---|---:|---:|---:|---:|:---:|
| Oil, peanut | 1750348 | 0 | 0 | 0 |  |
| Oil, sunflower | 1750349 | 0 | 0 | 0 |  |
| Raisins, dark, seedless | 2758980 | 0 | 0 | 0 |  |
| Dressing, Ranch | 2758988 | 0 | 0 | 0 |  |
| Baked beans, Original, canned, with pork | 2758982 | 0 | 0 | 0 | yes |
| Grapefruit, raw | 2758977 | 0 | 0 | 0 |  |
| Refried beans, canned (pinto) | 2758984 | 0 | 0 | 0 |  |
| Oil, olive, extra virgin | 748608 | 0 | 0 | 0 |  |
| Oil, corn | 748323 | 0 | 0 | 0 |  |
| Beans, baked, canned, vegetarian | 2758983 | 0 | 0 | 0 |  |
| Pasta, dry, whole grain, spaghetti  | 2759000 | 0 | 0 | 0 |  |
| Rhubarb, stalk, raw | 2758975 | 0 | 0 | 0 |  |
| Pasta, dry, enriched, spaghetti | 2758998 | 0 | 0 | 0 |  |
| Oil, soybean | 748366 | 0 | 0 | 0 |  |
| Cranberries, dried, sweetened | 2758976 | 0 | 0 | 0 |  |
| Juice, pomegranate, from concentrate, shelf-stable | 2727588 | 0 | 0 | 0 |  |
| Oil, safflower | 1750350 | 0 | 0 | 0 |  |
| Oil, olive, extra light | 1750351 | 0 | 0 | 0 |  |
| Eggshell powder (calcium supplement) | — | 0 | 0 | 0 | yes |

