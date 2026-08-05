# Eval fixtures

Inputs for `scripts/028_search_eval.ts`.

## `farmers-dog-turkey.jpg` (not committed — drop it here)

The bowl photo used as the accuracy baseline: a Farmer's Dog "Turkey Recipe"
serving. Ground truth is cooked ground turkey, carrots, broccoli, spinach and
chickpeas — **all cooked**, which is what makes it the right probe for
`pickDefault`'s `+100` raw bonus in `026_build_canonical_ingredients.ts`.

The image itself is not in git (it is a user photo, and the harness does not
need it once the labels below exist). Put it here, or pass `--image <path>`.

## `bowl-vision-labels.json` (committed, generated)

Trimmed Gemini output, written by `028_search_eval.ts --refresh`:

```json
{ "image": "...", "capturedAt": "...", "modelVersion": "gemini-2.5-flash",
  "notes": "...", "items": [{ "label": "...", "estimated_proportion": 0.0,
  "confidence": 0.0 }] }
```

`box_2d` is stripped — it feeds portion estimation, not search relevance, and
keeping it would churn this file on every refresh.

**It is committed on purpose.** Comparing a pre- and post-change snapshot is
only meaningful if both were scored against the same labels, and re-rolling
them silently would make a ranking change look like a model change. `--refresh`
is the deliberate opt-in to re-capture.

## Regenerating

```sh
cd apps/web
set -a && source .env.local && set +a   # needs GEMINI_API_KEY
npx tsx scripts/028_search_eval.ts --refresh --label with-photo
```
