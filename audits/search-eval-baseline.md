# Search evaluation — `baseline`

Generated 2026-08-04T22:41:36.837Z by `scripts/028_search_eval.ts`.

Measurement only — this script never gates on a metric. It compares what ships today (flat `fuzzy_search_foods`) against the canonical layer that exists but has no UI caller.

## Environment

- canonical layer: **HEALTHY** — 695 groups over 4700 attached foods
- active foods: 4700
- canonical groups: 695
- foods attached to a group: 4700
- MATCH_THRESHOLD: 0.5
- vision fixture: `apps/web/scripts/fixtures/farmers-dog-turkey.jpg`, gemini-2.5-flash, captured 2026-08-04T22:39:19.304Z

## Gemini labels

Model notes: The food is Buddy's Turkey Recipe.

| label | proportion | confidence | ground truth |
|---|---:|---:|---|
| ground turkey | 0.60 | 0.95 | `ground turkey` |
| carrots | 0.15 | 0.90 | `carrots` |
| spinach | 0.10 | 0.85 | `spinach` |
| broccoli | 0.08 | 0.85 | `broccoli` |
| chickpeas | 0.07 | 0.80 | `chickpeas` |

## Aggregate

Over 8 scored queries.

| metric | flat | grouped default | grouped best variant |
|---|---:|---:|---:|
| top-1 base correct | 8/8 | 8/8 | 8/8 |
| top-1 plausible part | 8/8 | 6/8 | 8/8 |
| top-1 prep correct | 3/8 | 3/8 | 8/8 |
| top-1 fully correct | 3/8 | 1/8 | 8/8 |
| correct within reach | 8/8 | 8/8 | 8/8 |
| auto-match fired | 8/8 | n/a | n/a |

`grouped best variant` is a **ceiling**, not a shipping number: it asks whether the correct group contains a fully-correct variant at all. The gap between it and `grouped default` is the cost of the default-variant policy; the gap between `grouped default` and `flat` is the value of grouping itself.

## Per query

Marks are `base/part/prep`.

| query | expectation | flat | grouped default | grouped best variant |
|---|---|---|---|---|
| `ground turkey` | cooked ground turkey — not giblets, neck, skin or a turkey frankfurter | Turkey, Ground, raw<br>`PASS/PASS/FAIL` prep=raw sim=0.657 | Turkey ground  →  Turkey, Ground, raw<br>`PASS/PASS/FAIL` prep=raw sim=0.800 | Turkey ground  →  Turkey, Ground, cooked<br>`PASS/PASS/PASS` prep=cooked sim=0.800 |
| `carrots` | cooked carrot, not carrot juice or baby-food carrot | Carrots, raw<br>`PASS/PASS/FAIL` prep=raw sim=0.880 | Carrot  →  Carrot, raw<br>`PASS/PASS/FAIL` prep=raw sim=0.667 | Carrot  →  Carrots, cooked, boiled, drained, with salt<br>`PASS/PASS/PASS` prep=cooked sim=0.667 |
| `spinach` | cooked spinach, not spinach souffle or baby food | Spinach, raw<br>`PASS/PASS/FAIL` prep=raw sim=0.880 | Spinach  →  Spinach, baby<br>`PASS/PASS/FAIL` prep=unknown sim=1.000 | Spinach  →  Spinach, cooked, boiled, drained, with salt<br>`PASS/PASS/PASS` prep=cooked sim=1.000 |
| `broccoli` | cooked broccoli — "Broccoli raab" is a different base food | Broccoli, raw<br>`PASS/PASS/FAIL` prep=raw sim=0.887 | Broccoli  →  Broccoli, raw<br>`PASS/PASS/FAIL` prep=raw sim=1.000 | Broccoli  →  Broccoli, chinese, cooked<br>`PASS/PASS/PASS` prep=cooked sim=1.000 |
| `chickpeas` | cooked chickpeas, not hummus or chickpea flour | Chickpeas, (garbanzo beans, bengal gram), dry<br>`PASS/PASS/FAIL` prep=unknown sim=0.753 | Chickpea  →  Chickpeas (garbanzo beans, bengal gram), mature seeds, raw<br>`PASS/PASS/FAIL` prep=raw sim=0.727 | Chickpea  →  Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, with salt<br>`PASS/PASS/PASS` prep=cooked sim=0.727 |
| `chicken` | the headline case — flat search returns "Chicken, feet, raw" as top-1 | Chicken, ground, raw<br>`PASS/PASS/PASS` prep=raw sim=0.800 | Chicken  →  Chicken, broilers or fryers, separable fat, raw<br>`PASS/FAIL/PASS` prep=raw sim=1.000 | Chicken  →  Chicken, stewing, meat only, raw<br>`PASS/PASS/PASS` prep=raw sim=1.000 |
| `chicken breast` | a breast cut, not breaded tenders | Chicken breast, boneless skinless, raw<br>`PASS/PASS/PASS` prep=raw sim=0.810 | Chicken breast  →  Chicken, broiler or fryers, breast, skinless, boneless, meat only, cooked, braised<br>`PASS/PASS/PASS` prep=cooked sim=0.813 | Chicken breast  →  Chicken, breast, meat and skin, raw<br>`PASS/PASS/PASS` prep=raw sim=0.813 |
| `turkey` | turkey meat, not turkey giblets or turkey neck | Turkey, Ground, raw<br>`PASS/PASS/PASS` prep=raw sim=0.790 | Turkey  →  Turkey, whole, giblets, raw<br>`PASS/FAIL/PASS` prep=raw sim=1.000 | Turkey  →  Turkey, whole, meat only, raw<br>`PASS/PASS/PASS` prep=raw sim=1.000 |

## Observations

- Fully correct top-1: flat 3/8, grouped default 1/8, grouped best variant 8/8.
- The grouped default was **raw** on 4 of 5 cooked-expected cases — `pickDefault` in scripts/026 awards +100 to `preparation_state = raw`, and nothing in either ranking path is context-aware about prep.
- 7 of 8 cases would already be correct if the group's default variant were chosen differently — the grouping is right, the representative is not. That is a `pickDefault` change, not a search change.
- 5 of 8 auto-matched to a row that is NOT fully correct — the bowl flow commits these silently, which is the failure mode the owner actually experiences.

