# Search evaluation — `baseline` → `after-fixes`

- `baseline`: 2026-08-04T22:41:36.837Z, canonical layer HEALTHY
- `after-fixes`: 2026-08-05T01:48:07.921Z, canonical layer HEALTHY

## Metric deltas

| side | metric | baseline | after-fixes |
|---|---|---:|---:|
| flat | top-1 base correct | 8/8 | 8/8 |
| flat | top-1 plausible part | 8/8 | 8/8 |
| flat | top-1 prep correct | 3/8 | 3/8 |
| flat | top-1 fully correct | 3/8 | 3/8 |
| flat | correct within reach | 8/8 | 8/8 |
| grouped default | top-1 base correct | 8/8 | 8/8 |
| grouped default | top-1 plausible part | 6/8 | 8/8 |
| grouped default | top-1 prep correct | 3/8 | 3/8 |
| grouped default | top-1 fully correct | 1/8 | 3/8 |
| grouped default | correct within reach | 8/8 | 8/8 |
| grouped best variant | top-1 base correct | 8/8 | 8/8 |
| grouped best variant | top-1 plausible part | 8/8 | 8/8 |
| grouped best variant | top-1 prep correct | 8/8 | 8/8 |
| grouped best variant | top-1 fully correct | 8/8 | 8/8 |
| grouped best variant | correct within reach | 8/8 | 8/8 |

## Per-case flips

| query | side | baseline | after-fixes |
|---|---|---|---|
| `chicken` | grouped default | FAIL | PASS |
| `turkey` | grouped default | FAIL | PASS |

