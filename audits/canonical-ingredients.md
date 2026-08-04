# Canonical ingredient build

_Generated 2026-08-04 by scripts/026_build_canonical_ingredients.ts (APPLIED)._

| Metric | Value |
|---|---|
| Active rows | 4700 |
| Canonical keys | 695 |
| Singleton keys | 294 |
| Review-queue items | 8 |
| Rows with unparsed segments | 3052 |

## Largest groups

```
  196  fish
  165  beef_round
  152  beef_chuck
  118  pork_loin
  107  beef_loin
  106  bean
   95  nut
   94  beef_rib
   91  pork_ham
   86  cheese
   78  chicken
   76  oil
   71  lamb
   71  potato
   66  beef_ribeye
   64  lamb_shoulder
   62  lamb_leg
   59  beef
   51  yogurt
   49  seed
   47  milk
   47  squash
   46  beef_short_loin
   45  beef_ground
   42  beef_brisket
   40  pepper
   37  game_meat
   37  pork
   35  turkey
   30  beef_sirloin
   29  lamb_loin
   28  beef_plate
   28  mollusk
   28  mushroom
   28  pork_shoulder
   26  flour
   26  pasta
   25  bean_kidney
   25  pea
   24  cabbage
```

## Top unclassified residual terms

Each is a gazetteer gap in `lib/food-name-parser.ts`. Adding the frequent
ones there is the cheapest way to improve grouping quality.

```
   64  sweet
   59  green
   53  yellow
   47  blade
   45  red
   35  bottom round
   31  top loin
   31  small end
   30  salmon
   28  sprouted
   28  greek
   26  top round
   25  top loin steak
   25  atlantic
   24  industrial
   23  snap
   23  plain
   22  lowfat
   22  arm
   22  summer
   22  winter
   21  french fried
   20  shoulder clod
   20  center rib
   19  low sodium
   19  back
   18  sulfured
   18  mock tender steak
   18  tip round
   18  porterhouse steak
   17  large end
   17  t-bone steak
   17  chinese
   17  chobani
   16  arm pot roast
   16  chopped
   16  domesticated
   16  rump
   16  shank
   16  sirloin
```

## Review queue

8 rows landed between 0.75 and 0.9 similarity against an existing canonical. They were KEPT SEPARATE (the conservative choice) and queued. Resolve each by adding a
SYNONYMS entry in `lib/food-name-parser.ts`, then re-run with `--reset`.

```
0.857  hormel_always_tender_tenderloin  ~  hormel_always_tender_loin
0.808  hormel_always_tender  ~  hormel_always_tender_loin
0.806  silk_strawberry_soy_yogurt  ~  silk_banana_strawberry_soy_yogurt
0.778  game_meat_round  ~  game_meat_ground
0.765  silk_very_vanilla  ~  silk_vanilla
0.750  mungo_bean  ~  mung_bean
0.750  wheat_flour_white  ~  flour_white
0.750  wheat_flour  ~  wheat_flour_white
```
