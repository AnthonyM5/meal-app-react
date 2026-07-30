# Canonical ingredient build

_Generated 2026-07-30 by scripts/026_build_canonical_ingredients.ts (APPLIED)._

| Metric | Value |
|---|---|
| Active rows | 4700 |
| Canonical keys | 1432 |
| Singleton keys | 783 |
| Review-queue items | 55 |
| Rows with unparsed segments | 1984 |

## Largest groups

```
  165  beef_round
  152  beef_chuck
  118  pork_loin
  107  beef_loin
   94  beef_rib
   91  pork_ham
   66  beef_ribeye
   64  lamb_shoulder
   62  lamb_leg
   46  beef_short_loin
   46  chicken
   45  beef_ground
   40  beef_brisket
   34  corn_sweet
   31  beef
   30  beef_sirloin
   29  fish_salmon
   29  lamb_loin
   28  beef_plate
   28  pork_shoulder
   28  yogurt_greek
   26  lamb
   25  beans_kidney
   24  oil_industrial
   24  rice_white
   23  beans_snap
   23  beef_tenderloin
   23  turkey
   22  squash_summer
   22  squash_winter
   20  beef_blade
   20  chicken_thigh
   20  veal_shoulder
   19  beef_flank
   19  chicken_drumstick
   19  wheat_flour_white
   18  beef_shoulder
   18  peppers_sweet
   18  potatoes_french_fried
   17  chicken_breast
```

## Top unclassified residual terms

Each is a gazetteer gap in `lib/food-name-parser.ts`. Adding the frequent
ones there is the cheapest way to improve grouping quality.

```
   47  blade
   35  yellow
   35  bottom round
   31  top loin
   31  small end
   31  white
   29  green
   29  top round
   25  top loin steak
   24  atlantic
   23  red
   22  shoulder clod
   22  arm
   20  center rib
   18  mock tender steak
   18  tip round
   18  porterhouse steak
   17  large end
   17  t-bone steak
   17  plain
   17  chobani
   16  arm pot roast
   16  rump
   16  shank
   16  sirloin
   16  from whole bird
   15  no salt added
   15  lowfat
   14  fast roasted
   14  pan-broil
   14  center loin
   14  long-grain
   13  low sodium
   13  fast fried
   13  top round steak
   13  tenderloin
   13  with added vitamin a and vitamin d
   12  americas beef roast
   12  short ribs
   12  top blade
```

## Review queue

55 rows landed between 0.75 and 0.9 similarity against an existing canonical. They were KEPT SEPARATE (the conservative choice) and queued. Resolve each by adding a
SYNONYMS entry in `lib/food-name-parser.ts`, then re-run with `--reset`.

```
0.892  pear_nectar_with_added_ascorbic_acid  ~  peach_nectar_with_added_ascorbic_acid
0.891  vitasoy_usa_organic_nasoya_extra_firm_tofu  ~  vitasoy_usa_organic_nasoya_tofu_plus_extra_firm
0.879  milk_without_added_vitamin_a_and_vitamin_d  ~  milk_without_added_vitamin_d
0.875  vitasoy_usa_organic_nasoya_firm_tofu  ~  vitasoy_usa_organic_nasoya_tofu_plus_firm
0.870  vitasoy_usa_organic_nasoya_tofu_plus_firm  ~  vitasoy_usa_organic_nasoya_tofu_plus_extra_firm
0.868  pear_nectar_without_added_ascorbic_acid  ~  pear_nectar_with_added_ascorbic_acid
0.867  milk_with_added_vitamin_a_and_vitamin_d  ~  milk_with_added_vitamin_d
0.865  applesauce_without_added_ascorbic_acid  ~  applesauce_with_added_ascorbic_acid
0.864  mushrooms_portabella  ~  mushroom_portabella
0.857  hormel_always_tender_tenderloin  ~  hormel_always_tender_loin
0.846  milk_buttermilk  ~  buttermilk
0.839  cheese_pasteurized_process  ~  cheese_food_pasteurized_process
0.833  emu_inside_drums  ~  emu_inside_drum
0.833  milk_without_added_vitamin_d  ~  milk_with_added_vitamin_d
0.833  mushrooms_maitake  ~  mushroom_maitake
0.833  mushrooms_oyster  ~  mushroom_oyster
0.833  vitasoy_usa_azumaya_firm_tofu  ~  vitasoy_usa_azumaya_extra_firm_tofu
0.824  mushrooms_enoki  ~  mushroom_enoki
0.824  mushrooms_white  ~  mushroom_white
0.822  lemon_juice_from_concentrate_canned_or_bottled  ~  lemon_juice_from_concentrate_bottled
0.818  silk_very_vanilla_soymilk  ~  silk_vanilla_soymilk
0.815  plums_without_added_sugar  ~  plums_with_added_sugar
0.813  refried_beans_traditional  ~  refried_beans_traditional_style
0.813  yardlong_beans  ~  yardlong_bean
0.808  peanut_butter_smooth_style  ~  peanut_butter_smooth
0.806  silk_strawberry_soy_yogurt  ~  silk_banana_strawberry_soy_yogurt
0.800  lima_beans_no_salt_added  ~  beans_no_salt_added
0.800  peppers_hot_chili  ~  peppers_hot_chile
0.800  raspberries  ~  raspberries_red
0.795  cheese_pasteurized_process_cheese_food_or_product  ~  cheese_food_pasteurized_process
0.786  winged_beans  ~  winged_bean
0.784  pineapple_juice_frozen_concentrate  ~  apple_juice_frozen_concentrate
0.771  pineapple_juice_canned_or_bottled  ~  apple_juice_canned_or_bottled
0.769  crustaceans_spiny_lobster  ~  crustaceans_lobster
0.769  mungo_beans  ~  beans_mung
0.769  passion_fruit_purple  ~  passion_fruit_juice_purple
0.769  silk_light_chocolate_soymilk  ~  silk_chocolate_soymilk
0.769  sorghum_whole_grain  ~  sorghum_flour_whole_grain
0.769  sweet_potatoes_french_fried  ~  potatoes_french_fried
0.765  fish_herring  ~  fish_oil_herring
0.765  fish_sardine  ~  fish_oil_sardine
0.765  sweet_potato_skin  ~  sweet_potato
0.763  soy_sauce_made_from_soy_and_wheat_low_sodium  ~  soy_sauce_made_from_soy_and_wheat
0.762  cheese_monterey_jack  ~  cheese_monterey
0.762  mushroom_oyster  ~  mushroom_king_oyster
0.762  seeds_sunflower_seed  ~  seeds_sunflower_seed_flour
0.759  grapefruit_juice_pink  ~  grapefruit_juice_pink_or_red
0.756  vitasoy_usa_organic_nasoya_silken_tofu  ~  vitasoy_usa_organic_nasoya_soft_tofu
0.750  fish_salmon  ~  fish_oil_salmon
0.750  flour_whole_wheat  ~  flour_wheat
0.750  ice_cream_light  ~  cream_light
0.750  radishes_red  ~  radishes
0.750  silk_vanilla_soymilk  ~  silk_light_vanilla_soymilk
0.750  soybeans_no_salt_added  ~  beans_no_salt_added
0.750  wheat_flour_white  ~  flour_wheat
```
