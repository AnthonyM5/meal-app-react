# Search evaluation — `after-zero-kcal` → `with-prep`

- `after-zero-kcal`: 2026-08-05T17:17:34.170Z, canonical layer HEALTHY
- `with-prep`: 2026-08-06T00:55:27.283Z, canonical layer HEALTHY

## Metric deltas

| side | metric | after-zero-kcal | with-prep |
|---|---|---:|---:|
| flat | top-1 base correct | 8/8 | 8/8 |
| flat | top-1 plausible part | 8/8 | 8/8 |
| flat | top-1 prep correct | 3/8 | 7/8 |
| flat | top-1 nutrition usable | 8/8 | 8/8 |
| flat | top-1 fully correct | 3/8 | 7/8 |
| flat | correct within reach | 8/8 | 8/8 |
| grouped default | top-1 base correct | 8/8 | 8/8 |
| grouped default | top-1 plausible part | 8/8 | 8/8 |
| grouped default | top-1 prep correct | 3/8 | 3/8 |
| grouped default | top-1 nutrition usable | 8/8 | 8/8 |
| grouped default | top-1 fully correct | 3/8 | 3/8 |
| grouped default | correct within reach | 8/8 | 8/8 |
| grouped best variant | top-1 base correct | 8/8 | 8/8 |
| grouped best variant | top-1 plausible part | 8/8 | 8/8 |
| grouped best variant | top-1 prep correct | 8/8 | 8/8 |
| grouped best variant | top-1 nutrition usable | 8/8 | 8/8 |
| grouped best variant | top-1 fully correct | 8/8 | 8/8 |
| grouped best variant | correct within reach | 8/8 | 8/8 |

## Per-case flips

| query | side | after-zero-kcal | with-prep |
|---|---|---|---|
| `ground turkey` | flat | FAIL | PASS |
| `carrots` | flat | FAIL | PASS |
| `spinach` | flat | FAIL | PASS |
| `broccoli` | flat | FAIL | PASS |

