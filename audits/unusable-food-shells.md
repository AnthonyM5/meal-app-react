# Unusable food shells — deactivation

Generated 2026-08-19T02:03:47.004Z by `scripts/030_deactivate_unusable_food_shells.ts` (APPLIED).

30 active rows carry no usable energy figure. They are soft-deleted
(`is_active = false`, `inactive_reason = 'unusable:no_energy_data'`), never
hard-deleted — `foods` cascades to `meal_items` and `recipe_ingredients`.

Re-fetching does not recover these: FDC publishes no energy and no proximates
for them either. See the script header.

## Empty shells — no energy, no macros (18)

Passed the old predicate because all-zero is legitimate for a supplement.
Eggshell powder, the one row where that is true, is marked
`data_completeness = 'non_caloric'` and is NOT in this list.

| food | kcal | protein | fat | carbs | fdc_id |
|---|---:|---:|---:|---:|---|
| Baked beans, Original, canned, with pork | 0 | 0 | 0 | 0 | 2758982 |
| Beans, baked, canned, vegetarian | 0 | 0 | 0 | 0 | 2758983 |
| Cranberries, dried, sweetened | 0 | 0 | 0 | 0 | 2758976 |
| Dressing, Ranch | 0 | 0 | 0 | 0 | 2758988 |
| Grapefruit, raw | 0 | 0 | 0 | 0 | 2758977 |
| Juice, pomegranate, from concentrate, shelf-stable | 0 | 0 | 0 | 0 | 2727588 |
| Oil, corn | 0 | 0 | 0 | 0 | 748323 |
| Oil, olive, extra light | 0 | 0 | 0 | 0 | 1750351 |
| Oil, olive, extra virgin | 0 | 0 | 0 | 0 | 748608 |
| Oil, peanut | 0 | 0 | 0 | 0 | 1750348 |
| Oil, safflower | 0 | 0 | 0 | 0 | 1750350 |
| Oil, soybean | 0 | 0 | 0 | 0 | 748366 |
| Oil, sunflower | 0 | 0 | 0 | 0 | 1750349 |
| Pasta, dry, enriched, spaghetti | 0 | 0 | 0 | 0 | 2758998 |
| Pasta, dry, whole grain, spaghetti  | 0 | 0 | 0 | 0 | 2759000 |
| Raisins, dark, seedless | 0 | 0 | 0 | 0 | 2758980 |
| Refried beans, canned (pinto) | 0 | 0 | 0 | 0 | 2758984 |
| Rhubarb, stalk, raw | 0 | 0 | 0 | 0 | 2758975 |

## Truncated payloads — protein only (12)

Payload carried protein but neither fat nor carbohydrate, so scripts/029
derived energy from the protein alone. These read 1-6 kcal against real values
of 16-72, and were ACCEPTED by the old predicate because the derived figure is
above zero.

| food | kcal | protein | fat | carbs | fdc_id |
|---|---:|---:|---:|---:|---|
| Cabbage, napa, leaf, destemmed, raw | 4.26 | 1.06 | 0 | 0 | 2727583 |
| Green onion, (scallion), bulb and greens, root removed, raw | 2.68 | 0.67 | 0 | 0 | 2727585 |
| Juice, prune, shelf-stable | 1.69 | 0.42 | 0 | 0 | 2727587 |
| Juice, tart cherry, from concentrate, shelf-stable | 0.59 | 0.15 | 0 | 0 | 2727589 |
| Leeks, bulb and greens, root removed, raw | 5.87 | 1.47 | 0 | 0 | 2727584 |
| Pawpaw, peeled, seeded, raw | 4.61 | 1.15 | 0 | 0 | 2727577 |
| Rutabaga, peeled, raw | 3.55 | 0.89 | 0 | 0 | 2727580 |
| Shallots, bulb, peeled, root removed, raw | 5.51 | 1.38 | 0 | 0 | 2727586 |
| Squash, pie pumpkin, peeled, seeded, raw | 3.42 | 0.85 | 0 | 0 | 2727578 |
| Squash, spaghetti, peeled, seeded, raw | 3.17 | 0.79 | 0 | 0 | 2727579 |
| Tomatillos, dehusked, raw | 4.26 | 1.06 | 0 | 0 | 2727582 |
| Watermelon, seedless, flesh only, raw | 3.49 | 0.87 | 0 | 0 | 2747675 |

## Canonical groups removed (3)

Every member was unusable, so the group would have ranked with zero variants.
`scripts/026` rebuilds `canonical_ingredients` from active rows and will not
recreate these.

- `790a1608-f39d-4170-8cd4-ec3eef8418a4`
- `5918f706-aa4e-4cd5-8304-3b63560eb2c0`
- `ce4c0172-b97b-4b30-87ab-a47cd7943634`
