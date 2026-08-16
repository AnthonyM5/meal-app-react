# Food Data Integration (USDA + Open Food Facts)

_Rewritten 2026-07-12. The previous version of this doc described the
NutriTrack-era `lib/usda-api.ts` client, which was deleted in Phase 3.6 —
see `docs/PAWPLATE_PROGRESS.md`._

## Overview

PawPlate resolves food data from two tiers:

1. **USDA FoodData Central (FDC)** — the trusted, deterministic tier.
   Foundation + SR Legacy whole foods are imported into the `foods` table
   with full canine nutrient profiles. This is the only data the nutrient
   gap engine trusts.
2. **Open (Pet) Food Facts** — the branded tier. Products are looked up on
   demand and cached into `foods` (`source='off'`) only when an owner
   accepts a suggestion. Macros only; micros stay `null` and are excluded
   from gap math.

## Environment

```env
USDA_API_KEY=...            # or NEXT_PUBLIC_USDA_API_KEY
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...  # scripts + payload archive
```

Open Food Facts requires no key (identify via User-Agent, set in
`lib/off-integration.ts`).

## Current modules

| Module | Role |
|---|---|
| `lib/usda-canine.ts` | FDC → `foods` row conversion: 48-nutrient extraction, unit conversions, `inferPreparationState()`, `checkDogSafety()` pass, `is_verified` completeness gate |
| `lib/dog-toxic-foods.ts` | Name-based toxicity rules (word-boundary matching for short terms) |
| `lib/off-integration.ts` | OFF/OPFF barcode + name lookups and `convertOFFToIngredient()` (tries Open Pet Food Facts first, then Open Food Facts; ODbL attribution) |
| `lib/resolve-ingredient.ts` | Shared resolution chain: local `fuzzy_search_foods` match (never auto-matches unsafe rows) → OFF suggestion with timeout |
| `lib/ingredient-actions.ts` | Server actions: `acceptBrandedIngredient` (cache-on-accept) and `createManualIngredient` (owner-estimated fallback) |
| `lib/source-payloads.ts` | Archives every raw API response into `source_payloads` so re-derivation never re-fetches |
| `scripts/022_bulk_import_usda_wholefoods.ts` | Filtered bulk import of the whole-food corpus (category whitelist + safety pass; `--dry-run`/`--category`/`--refresh`) |
| `scripts/020_seed_staple_gaps.ts` | Pinned fdc_id seed for the pre-bulk staple set (kept for provenance) |
| `app/api/foods/unified-search/route.ts` | Search endpoint over `fuzzy_search_foods` used by `use-ingredient-search` |

### Imports are script-only

Catalog imports run from `scripts/` with explicit operator credentials — there
is **no HTTP import endpoint**, by design.

`app/api/ingredients/import` and `app/api/foods/import-external` used to expose
query-triggered imports over HTTP. Both were deleted: they had no auth check of
their own, wrote to the shared `foods` table with the service-role key, and had
no caller in the app. `/api/foods/import-external` was additionally reachable
unauthenticated, because `middleware.ts` prefix-matched `/api/foods` as a
guest-allowed route. `import-external` also predated the canine normalization
work — it never set `fdc_id` or `is_safe_for_dogs` and bypassed
`convertUSDAToIngredient` entirely, so its rows were malformed relative to the
current schema.

Use `scripts/022_bulk_import_usda_wholefoods.ts` (bulk, category-filtered),
`scripts/018_import_raw_counterparts.ts`, or
`scripts/import-cooked-ingredients.ts` instead. If an HTTP import is ever
needed again, it requires its own authentication and authorization — a
middleware prefix list is not a substitute.

## FDC endpoints used

- `GET /foods/search?query=*&dataType=Foundation,SR Legacy&pageSize=200` —
  corpus enumeration (search results carry `foodCategory`; the `/foods/list`
  endpoint does not, which is why enumeration goes through search).
- `POST /foods` (`{ fdcIds, format: 'full' }`, max 20 ids) — batched detail
  fetch. No nutrient filter: the complete payload is archived.
- `GET /food/{fdcId}?format=full` — single-food fetch (seed scripts, import
  route).

Rate limit: 1,000 requests/hour per key. The bulk import sleeps 500 ms
between requests (~300 requests for a full run).

## Search

`fuzzy_search_foods(search_query, match_limit)` (Postgres, pg_trgm):

- scores `GREATEST(similarity(name), similarity(brand), word_similarity(query, name))`
  — `word_similarity` is what lets a short label ("macaroni") match a long
  USDA description ("Macaroni, vegetable, enriched, cooked");
- thresholds: whole-string 0.2, word 0.5; the bowl auto-matcher additionally
  requires ≥ 0.3 and rejects `is_safe_for_dogs=false` rows;
- returns provenance (`source`, `data_completeness`, `is_complete_food`) so
  UIs can badge branded/custom rows;
- ranks: similarity → trusted source (usda/curated) → safe → verified → name.

## Safety model (two layers)

1. **Category whitelist** at bulk-import time — prepared dishes, snacks,
   sweets, beverages etc. are never fetched, closing the composite-name hole
   ("beef stroganoff mix" names no toxic ingredient).
2. **`checkDogSafety(name)`** on every conversion — toxic whole foods inside
   whitelisted categories (onion, garlic, grapes) import flagged
   `is_safe_for_dogs=false` with a `toxicity_note`. They are searchable and
   badged but never auto-matched to a bowl item.

## Licensing

OFF/OPFF data is ODbL: every cached row carries
`source_attribution` ("Nutrition data © Open (Pet) Food Facts contributors,
ODbL") and `source='off'` so it can be isolated from any future data export.
See `docs/BRANDED_INGREDIENTS_DESIGN.md` §7.
