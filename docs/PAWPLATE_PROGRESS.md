# PawPlate — Implementation Progress & Production Plan

Status as of 2026-07-17, branch `feat/calendar-view`. Tracks the phases from the
PawPlate handoff plan. The old Supabase instance (`nutrition-app`,
`alrdvdblyiwaptbsnjxh`) is `INACTIVE` (free-tier auto-pause) and was
abandoned rather than restored. A **new Supabase project is live and
migrated**: `pawplate` (`stdqdzvhexqgodpuriaw`, `us-east-1`) — see
Supabase Integration below.

## Done (tested locally)

### Phase 0 — Rebrand

- NutriTrack → PawPlate across `app/layout.tsx`, `public/manifest.json`,
  landing page, README, service worker, mobile app. `package.json` name →
  `pawplate`.

### Phase 1 — Schema

> **Note (2026-07-27):** this section refers to numbered `.sql` files under
> `apps/web/scripts/`. Those were byte-identical duplicates of the timestamped
> migrations they name, and were deleted in the cleanup pass —
> `supabase/migrations/` is now the single source of truth. The script names
> below are kept for historical accuracy; read them as pointers to the
> migration each one names.

- `scripts/010_pawplate_schema.sql` (mirrored at
  `supabase/migrations/20260706000000_pawplate_schema.sql`): `dogs`,
  `nutrient_requirements`, `bowl_analyses` tables with RLS; canine nutrient
  columns on `foods`; `meals.dog_id` + `meals.source`; `weight_logs.dog_id`;
  drops `water_intake` / `exercise_logs`; `fdc_id` made nullable (hand-curated
  ingredients have no USDA id). Idempotent — safe to re-apply.
- **Decision:** the physical table stays named `foods`; the TS layer exposes it
  as `Ingredient` (avoids breaking the USDA importer and `fuzzy_search_foods`).
- Seeds: `011_seed_nutrient_requirements.sql` (50 rows, AAFCO 2016 per-1000-kcal
  values, adult + puppy; **transcribed reference values — the app presents all
  guidance behind a generic informational disclaimer, see Key caveats**) and
  `012_seed_dog_ingredients.sql` (38 ingredients incl.
  7 toxic items flagged with `is_safe_for_dogs = FALSE`).
- Verified against the live hosted `pawplate` project (see Supabase
  Integration below): full migration chain applies cleanly via
  `supabase db push`, RLS enabled on all tables, `fuzzy_search_foods`
  works (handles typos), re-apply is idempotent.
  - Historical note: the migrations were first validated on local
    Postgres.app with a stubbed `auth` schema, before the hosted project
    existed. That stub was a throwaway scratchpad helper — never committed
    — and is now retired. **All migration/DB verification from here on runs
    against the linked Supabase project** (`supabase db push`,
    `supabase migration list`, or `psql` over the pooler), not a local
    stub.

### Phase 2 — Deterministic nutrient engine

- `lib/canine-nutrition.ts`: RER (70·kg^0.75), MER factor table, meal totals
  across 25 tracked nutrients, per-1000-kcal target resolution, gap
  classification (deficient / adequate / excess / toxic_risk / informational),
  Ca:P ratio, unsafe-ingredient detection. No network/LLM (grep-verified).
- `lib/dog-actions.ts`, `lib/meal-actions.ts`: server actions mirroring the
  guest-mode-aware `recipe-actions.ts` pattern. `createDogMeal` /
  `getDogDailyGaps` return computed gaps + `requiresVetNotice` when the dog
  has health conditions.
- 27 Jest tests in `__tests__/lib/canine-nutrition.test.ts` (RER known value,
  hand-computed reference meal, toxic-range vitamin D, life-stage mapping,
  weight-loss energy prescription).

### Phase 3 — USDA ingredient pipeline

- Nutrient IDs verified against **live FDC data** (fixture:
  `__tests__/fixtures/usda-chicken-liver-171060.json`). Note: the handoff's
  guess "methionine 1090" was wrong — 1090 is magnesium; methionine is 1215.
  Iodine (1100) confirmed via Foundation egg foods. **Taurine is not reported
  by FDC at all** — deliberately absent from the extractor; curated table is
  the future path (handoff §3.3).
- `lib/usda-canine.ts`: 34-ID extractor (both FDC response shapes), unit
  conversions (µg vit D ×40 → IU, g→mg aminos/fatty acids), sparse-profile
  detection → `is_verified = false`.
- `lib/dog-toxic-foods.ts`: cited toxic list + `checkDogSafety()` name matcher.
- `app/api/ingredients/import/route.ts`: Foundation/SR-Legacy import with
  `fdc_id` dedupe and safety pass.
- 24 Jest tests against the captured fixture.

### Phase 4 — Vision pipeline (scaffold, live-tested)

- **Provider switched to Google Gemini** (`gemini-2.5-flash`) per project
  decision — `GEMINI_API_KEY` in `.env.local` (never client-side).
- `lib/vision/analyze-bowl.ts`: structured JSON via Gemini `responseSchema`,
  Zod validation, one corrective retry. Returns labels + rough proportions
  only — **no gram claims from photos** (physics limitation, per handoff).
- `app/api/bowl/analyze/route.ts`: POST (upload → Supabase Storage
  `bowl-photos` → vision → normalize labels via `fuzzy_search_foods` →
  persist `bowl_analyses`), PATCH (persist `user_corrected` — the eval signal).
- Live smoke test passed: correctly identified kibble + water in a test photo,
  ~5s latency, schema-valid output.
- Confirmation UI + full photo→meal flow shipped 2026-07-08 (see below).

### Dog-centric UI + first authenticated flow (done, 2026-07-07)

All six planned tasks are complete and verified against the live `pawplate`
project:

1. **Auth + RLS smoke test** — `scripts/verify-live-auth.ts` (run with
   `set -a && source .env.local && set +a && npx tsx scripts/verify-live-auth.ts`).
   Creates two confirmed users via the admin API (email confirmations are on
   remotely, so UI signup can't complete headlessly), verifies the
   `handle_new_user` trigger creates `profiles`, signs in with the anon key,
   and proves RLS isolation on `dogs` (cross-user select/insert/update/delete
   all blocked). 11/11 checks pass; cleans up after itself.
2. **`/dogs` route** — `app/dogs/{page,dogs-page}.tsx` +
   `components/dog-form.tsx` (Radix Dialog/Select/Switch). Add/edit/delete
   with confirm dialog; each card shows life stage, activity, and the
   computed ~kcal/day from the deterministic engine.
3. **Per-dog dashboard** — `app/dashboard/dashboard-page.tsx` rewritten:
   dog selector, daily kcal progress vs `dailyEnergyForDog`, nutrient
   coverage panel (`components/nutrient-gap-bars.tsx`, status-colored bars
   sorted problems-first), destructive alert for `unsafeIngredients`, and
   the `requiresVetNotice` consult-your-vet notice.
4. **Manual meal logging** — `components/dog-meal-builder.tsx`: debounced
   ingredient search against `/api/foods/unified-search`, grams per item,
   inline unsafe-ingredient warnings, `createDogMeal` → gaps refresh. New
   `getDogMeals` action lists today's meals for display/deletion.
5. **Guest mode preserved** — `/dashboard` guest banner + explore section
   unchanged; `/dogs` added to `GUEST_ALLOWED_ROUTES` and shows a sign-in
   banner. Guest-cookie checks moved into effects (render-time reads caused
   React 19 hydration errors).
6. **Cypress spec** — `cypress/e2e/dog-nutrition-flow.cy.ts` (2/2 passing):
   sign in → add dog → log meal → assert kcal + gap bars, plus a guest-mode
   regression test. `cypress.config.ts` gained `createTestUser`/
   `deleteTestUser` tasks using the service-role admin API; run with env
   sourced from `.env.local`. (Local quirk: run Cypress with
   `env -u ELECTRON_RUN_AS_NODE` when launched from Electron-based shells.)

### Test/build state

- `npm test`: 107/107 passing. `next build`: compiles (`/dogs` +
  `/dashboard` both in the route manifest). Cypress dog flow: 2/2.
- Pre-existing (not from this work): tsc errors in `mobile/` (deps not
  installed), `components/signup-form.tsx`, `lib/nutrition-calculator.ts`,
  and the Next 15 async-params error in `.next/types` (build has
  `ignoreBuildErrors: true`).
- Fixed: `lib/database.types.ts` had a Supabase CLI update notice appended
  to the generated output (broke `tsc`); removed.

### Raw vs cooked ingredients (done, 2026-07-07)

Per-100 g values differ materially between preparations (roasted chicken
breast: 165 kcal / 31 g protein vs raw: 120 / 22.5 — water loss concentrates
everything, and heat degrades B-vitamins / leaches minerals), so both
variants now coexist as separate rows. **Values always describe the food as
fed; no raw→cooked conversion math anywhere.**

- `preparation_state` column (`raw`|`cooked`|NULL) on `foods` —
  `scripts/014` / migration `20260707010000`, with a name-based backfill
  (supplements/dairy stay NULL). Live counts after import: raw 21,
  cooked 19, NULL 10.
- `inferPreparationState()` in `lib/usda-canine.ts` labels every future
  USDA import automatically (whole-word `raw` beats cooking-method words;
  unit-tested).
- 12 cooked SR Legacy variants imported live via
  `scripts/import-cooked-ingredients.ts` (chicken breast/thigh roasted+
  stewed, liver simmered, 90% lean beef ×2, ground turkey, egg hard-boiled+
  omelet, salmon, sweet potato) — all `is_verified`, all correctly labeled.
  Re-runnable; dedupes on `fdc_id`; excludes fried/breaded/restaurant/canned.
- **`fuzzy_search_foods` RPC return set extended** (`scripts/015` /
  migration `20260707020000`): the pre-PawPlate signature never returned
  `is_safe_for_dogs` / `toxicity_note` / `preparation_state`, so search
  results couldn't power the unsafe-ingredient warning at all. Now verified
  live: onion search returns `safe=False` + note; meal-builder shows
  raw/cooked badges.
- If a cooked FDC analog ever doesn't exist: USDA's _Nutrient Retention
  Factors_ (Release 6) + _Cooking Yields for Meat and Poultry_ tables are
  the deterministic fallback — but measured entries always win.

### Meal editing + food browse/search (done, 2026-07-07)

Two user-requested capabilities plus a canine rebuild of the old food
detail page.

- **Edit logged meals** — `getDogMealForEdit` (loads a meal's items with
  full ingredient rows; ownership checked via the `dogs!inner` join) and
  `updateDogMeal` (replaces items/grams/meal type, recomputes and returns
  fresh gaps; deletes-then-reinserts `meal_items` with the _old_ items kept
  and re-inserted on failure so a meal is never left empty). `DogMealBuilder`
  gained an `editingMeal` mode (prefilled items, "Save changes" / cancel);
  dashboard "Today's meals" cards got an edit (pencil) button that reopens
  the builder in place and highlights the row.
- **`/foods` browse page** (`app/foods/`) — two tabs: search by name
  (reuses `unified-search`) and **search by nutrient** (the "find foods high
  in lysine" ask). Cards link to the detail page and, for nutrient search,
  show the amount + are sorted highest-first.
- **Generic `search_foods_by_nutrient` RPC** (`scripts/016` / migration
  `20260707030000`) replaces the pre-PawPlate 5-nutrient CASE version with a
  column-driven one covering all 25 tracked canine nutrients. **SQL-injection
  safe**: the column name is validated against `information_schema` before
  `format(%I)` interpolation, and the API route (`/api/foods/nutrient-search`)
  independently allowlists against `TRACKED_NUTRIENTS`. Verified live: lysine
  search returns cooked chicken breast top; a malicious column name raises.
- **Food detail page rebuilt** (`food-details-view.tsx`) — canine nutrient
  groups (macros/minerals/vitamins/amino acids/fatty acids), raw/cooked +
  unsafe badges, and a dog-aware "log to a dog's meal" form (dog + meal +
  grams → `createDogMeal`). Guest users see a sign-in prompt.
- **Fixed a pre-existing guest-mode bug**: the old detail page queried
  `foods` directly with the anon client, but RLS only grants SELECT to
  `authenticated`, so guests got "Food not found". New `/api/foods/[foodId]`
  route proxies through the service role (same pattern as the search
  routes). `/foods` + `/food-details` added to the middleware guest allowlist.
- **Fixed another pre-existing app-wide bug**: sonner's `<Toaster>` was
  never mounted in any layout, so _every_ `toast()` call in the app was
  silently dropped (no "meal logged" / error feedback anywhere). Mounted it
  in `app/layout.tsx`.
- `NUTRIENT_LABELS` + a new `nutrientUnit()` helper moved to
  `lib/canine-nutrition.ts` as the single source of truth (gap bars and the
  nutrient browser both consume them).
- Cypress `dog-nutrition-flow.cy.ts` now 3/3: the log-meal test also edits
  the meal and asserts the kcal total changes; a new test browses by name,
  searches by lysine (asserting descending sort), checks the empty state,
  and logs from a detail page.

### Phase 4 UI — bowl photo → confirmation → meal (done, 2026-07-08)

The vision backend finally has a user surface; live-verified against real
Gemini (7.9 s, correct identification, confirmation UI rendered).

- **`/bowl` route** (`app/bowl/`) — dog selector + a single file input with
  `capture="environment"` (rear camera on mobile, file picker on desktop).
  Uploads to `POST /api/bowl/analyze`, then hands the result to the
  confirmation UI. Reachable from a new **"Log from photo"** button on the
  dashboard (carries `?dog=<id>`).
- **`components/bowl-confirmation.tsx`** — shows the photo, the model's items
  with **percent-of-bowl + confidence** (never grams — the physics limit is
  enforced in the UI), low-confidence items flagged amber, unmatched labels
  blocked from submission until resolved. Owner can replace a wrong match,
  remove an item, add a missed one, and must enter real grams. On confirm →
  `createDogMeal(..., { source: 'photo' })` **and** `PATCH` the analysis with
  `user_corrected` (the Phase 6 eval signal). Unsafe ingredients surface a
  destructive alert with ASPCA guidance.
- **Shared search hook** `hooks/use-ingredient-search.ts` — extracted the
  debounced `unified-search` logic; both the meal builder and the bowl
  confirmation picker use it now.
- **Security hardening of `/api/bowl/analyze`** (the route was
  service-role + unauthenticated at the app layer): now requires a session,
  verifies the caller **owns the `dog_id`** on POST (checked _before_ reading
  the upload or calling Gemini — no spend on a foreign dog), and verifies
  **analysis ownership** on PATCH. `dog_id` is now required (a dogless
  analysis couldn't be ownership-checked). POST response is enriched with the
  full matched ingredient rows in one `.in()` query so the client needs no
  extra round-trips.
- **Env-key fix**: `GEMINI_API_KEY` was failing with `API_KEY_INVALID`. Two
  bugs: the new key had been added to `.env` as `GEMINI_KEY` (wrong name), and
  `.env.local` still held the **old, revoked** key under the right name and
  shadowed it (Next precedence: `.env.local` > `.env`). Consolidated the
  validated key into `.env.local` as `GEMINI_API_KEY`; removed the misnamed
  `.env` entry. Verified both keys by HTTP status (new 200 / old 400).
- **Cypress** `cypress/e2e/bowl-photo-flow.cy.ts` (4/4): stubbed-Gemini happy
  path (upload → confirm grams → asserts meal persisted with `source:'photo'`
  and `user_corrected` PATCH sent), plus three authz tests (foreign dog → 404,
  missing `dog_id` → 400, foreign analysis PATCH → 404). Real-Gemini pass was
  a throwaway spec, since removed.

### USDA nutrient coverage audit + fix (done, 2026-07-08)

Per `NUTRIENT_API_SOURCING_AND_AUDIT.md` §3. Live-audited the 34-ID extractor
in `lib/usda-canine.ts` against a real 8-food `format=full` sample (chicken
breast/liver, beef, salmon, egg, spinach, broccoli, sweet potato) spanning
meats, organs, and produce.

- **Found**: 8 of AAFCO's 10 essential amino acids (threonine, isoleucine,
  leucine, phenylalanine, tyrosine, valine, arginine, histidine) and 5
  B-vitamins (thiamin, riboflavin, niacin, pantothenic acid, B6) were present
  in every sampled food but not extracted — the gap engine was silently blind
  to deficiencies in these. Vitamin K deliberately excluded: AAFCO sets no
  canine dietary requirement (dogs synthesize it via gut flora), same
  treatment as taurine.
- **Fixed**: extended `USDA_CANINE_NUTRIENT_IDS`/`extractCanineNutrients`
  (34 → 48 tracked IDs; sparse-profile threshold scaled 15→21 to hold the same
  ~44% bar), `lib/types.ts` `Food`, and `TRACKED_NUTRIENTS`/`NUTRIENT_LABELS`
  in `lib/canine-nutrition.ts`. Migrations `20260708000000` (12 new `foods`
  columns) and `20260708000100` (AAFCO 2016 requirement rows for the new
  nutrients, adult + puppy — **same transcribed-value caveat as
  `011_seed_nutrient_requirements.sql`**) applied live.
  `__tests__/lib/usda-canine.test.ts` extended against the existing chicken-
  liver fixture (36/36 passing).
- **Backfilled** the 12 already-imported USDA ingredients via
  `scripts/017_backfill_amino_and_b_vitamins.ts` (re-fetches `format=full`,
  re-derives, updates just the new columns + `is_verified`).
- **Live DB check**: of 50 `foods` rows, 8 curated (hand-entered, no `fdc_id`)
  were `is_verified: false` — sparse profiles for beef kidney, ground beef,
  chicken breast/thigh, lamb, pork tenderloin, and turkey, all raw. 7 of 8 had
  a real Foundation/SR Legacy raw analog; imported as new verified rows via
  `scripts/018_import_raw_counterparts.ts` (kept the curated rows rather than
  replacing — a `meal_item` could reference one — so both coexist; kelp
  powder, a supplement with no FDC entry, was left as the sole unverified
  curated row). `foods` now has 57 rows, 19 USDA-sourced, all verified.
- **Also found, not touched**: `lib/usda-api.ts`, `lib/usda-integration.ts`,
  `lib/enhanced-food-actions.ts`, `components/enhanced-food-search.tsx`,
  `app/api/usda-search/route.ts`, and `scripts/import-popular-foods.ts` /
  `optimized-bulk-import.ts` are leftover NutriTrack (human-nutrition) era
  code — a shallower 5–12-nutrient extractor, no dog-safety pass, no
  raw/cooked labeling — and are **unreachable from the app** (grep confirms
  no import path from any routed page). Candidates for deletion whenever
  there's appetite for cleanup; left alone this session since it wasn't
  the ask.
- **Audit deliverables written** (2026-07-08, second pass) under `audits/`:
  - `usda-nutrient-coverage.md` + `.json` (AC #1) — 20-food live diff of mapped
    vs. available nutrients, every unmapped field classified. Headline: **no
    AAFCO-required canine nutrient is being dropped** post-expansion; only soft
    candidate is moisture/water (1051) for dry-matter-basis math.
  - `usda-food-coverage.md` (AC #3) — corpus coverage **19 / 8187 = 0.23%** of
    Foundation+SR Legacy, framed as by-design (curated importer, not bulk load).
  - `usda-nonnutrient-fields.md` (AC #4) — keep/discard decision per non-nutrient
    `format=full` field. Top future adds: `foodPortions` (household units),
    `dataType`, `foodCategory`, `publicationDate`.
- **Audit AC status**: #1 ✅, #3 ✅, #4 ✅ done; #2 ✅ (raw/cooked gap table,
  now 44 staples) and #5 ✅ (raw-JSON persistence — `source_payloads`, Phase
  3.5) done as of 2026-07-10. OFF fallback source (§2) started (Phase 3.5);
  FatSecret still deferred.

### Phase 3.5 — Staple coverage & branded-food kickoff (done, 2026-07-10)

Hardening of the Phase 3 USDA pipeline plus the first slice of the branded
(Open Food Facts) plan from `docs/BRANDED_INGREDIENTS_DESIGN.md`:

- **Classifier fix**: `inferPreparationState()` now treats `uncooked` as raw
  (FDC's dry-grain wording; resolved the audit's quinoa false-flag). Regression
  test added to `__tests__/lib/usda-canine.test.ts`.
- **Raw payload persistence (audit §3.4, done)**: new `source_payloads` table
  (migration `20260711000000`) + `lib/source-payloads.ts` `storePayload()`,
  wired into every USDA fetch site (`import-cooked-ingredients.ts`, `018`,
  `020`, `/api/ingredients/import`) and the OFF helpers. Detail payloads link
  to their `foods` row; search payloads preserve the excluded candidates, so
  later coverage passes can widen from stored data instead of re-fetching.
- **Staple gaps closed**: `scripts/020_seed_staple_gaps.ts` pins the exact
  fdc_ids of the 12 previously script-only cooked imports (reproducible on a
  fresh DB, idempotent against the live one — verified: 12 skips) and imports
  the missing legumes: chickpeas + lentils, raw + cooked-unsalted (4 new
  verified rows; `foods` now 61 rows, 23 USDA-sourced).
- **Staple list expanded 34 → ~45** (`audits/pawplate-staple-ingredients.md`):
  whitefish, mackerel, herring, zucchini, cauliflower, cucumber, watermelon,
  strawberries, cranberries, black beans, + new fats/oils category (coconut
  oil, flaxseed oil), each with a verified vet-class citation.
  `scripts/019_audit_raw_cooked_gaps.ts` extended to 44 audited staples —
  re-run: **44/44, 0 gaps** (import of the new staples is a follow-up pass).
- **OFF mapper (design §10 step 3, first slice)**: `lib/off-integration.ts` —
  barcode + name lookups trying **Open Pet Food Facts first, then Open Food
  Facts** (live testing showed pet products resolve on OPFF, not OFF), and
  `convertOFFToIngredient()` (macros, salt→sodium via /2.5, minerals g→mg,
  unreported nutrients `null` never 0, per-host ODbL attribution,
  `source='off'`, never verified; returns null when kcal is unreported since
  `calories_per_serving` is NOT NULL). CLI smoke harness:
  `scripts/021_test_off_mapper.ts <barcode> [--insert]` — dry-run by default.
  Deferred per design: shared `resolveIngredient()` chain, bowl/meal-flow
  wiring, barcode-scan UI, source badges, FatSecret, attribution UI.

### Phase 3.6 — Broad coverage: filtered bulk import, OFF resolver, manual fallback (2026-07-12)

Prompted by a real bowl (macaroni + red cabbage + broth) whose items could be
_detected_ but not _tagged_: the trace showed nothing is filtered at vision
time — items failed at fuzzy-match (no such `foods` rows) and the confirm
gate then forced deleting them, silently under-counting the meal.

- **Two-tier coverage model** (decided with user): `foods` stays the curated
  deterministic table, broadened by a **filtered bulk import** of USDA
  Foundation + SR Legacy; USDA Branded (456k) and OFF (3.9M) are _never_
  bulk-loaded — branded items resolve on demand and cache on accept.
- **Bulk import** — `scripts/022_bulk_import_usda_wholefoods.ts`: enumerates
  the whole corpus via `/foods/search?query=*` (search results carry
  `foodCategory`; the `/foods/list` endpoint does not), keeps 12 dog-relevant
  categories (~5,000 of 8,187; both data types — Foundation also carries
  sausages/baked/restaurant categories), batch-fetches `format=full` details
  (POST `/foods`, 20/batch), converts via `convertUSDAToIngredient`, upserts
  on `fdc_id`, archives every search page + detail payload to
  `source_payloads`. `--dry-run` / `--category=` / `--refresh` guardrails.
  Toxic whole foods in whitelisted categories (onion, garlic, grapes) import
  flagged `is_safe_for_dogs=false` — kept for the safety layer.
- **Safety fixes**: `checkDogSafety` short patterns (≤4 chars) now match as
  whole words + plural — "rum" no longer flags "Wheat, durum"/"bread crumbs",
  "wine" no longer flags "swine"; substring behavior kept for longer terms so
  "grape" still catches "grapefruit". Bowl auto-match (`matchLocalIngredient`)
  never selects an `is_safe_for_dogs=false` row.
- **Search upgrades** (migrations `20260712000000` + `20260712000200`):
  `fuzzy_search_foods` now returns `source`/`data_completeness`/
  `is_complete_food`, ranks trusted sources and safe rows first, and scores
  with `word_similarity` as well as whole-string trigram — long USDA names
  had depressed single-word labels below the 0.3 auto-match floor
  (similarity('macaroni', 'Macaroni, vegetable, enriched, cooked') = 0.28;
  word_similarity = 1.0).
- **OFF resolve-and-cache** (design §10 steps 3–5 core): `lib/resolve-ingredient.ts`
  (`matchLocalIngredient` → `suggestBranded`, 4s OFF timeout) wired into
  `identifyBowl`; unmatched bowl items now carry a `branded_suggestion`.
  Accepting it (`acceptBrandedIngredient` in `lib/ingredient-actions.ts`)
  fetches the canonical OFF record, caches it into `foods`
  (`source='off'`, barcode-unique, ODbL attribution) — cache-on-accept, never
  on-fetch, so generic labels can't pull crowd junk into the table.
- **Manual fallback** (`createManualIngredient` + `CustomEntryForm` in
  `bowl-confirmation.tsx`): an unmatched item can be logged with an estimated
  kcal/100g as a `source='manual'`, sparse, unverified row — it counts toward
  the meal total instead of being deleted. Confirm gate now offers three
  resolution paths (search / accept branded / log custom); search results show
  "branded"/"custom" badges in both the bowl picker and meal builder.
- **Legacy NutriTrack import chain deleted** (it wrote 12–20-column
  human-schema rows with `is_verified: true` and no safety pass, and
  `/api/usda-search` was still publicly routable): `lib/usda-api.ts`,
  `lib/usda-integration.ts`, `lib/enhanced-food-actions.ts`,
  `components/enhanced-food-search.tsx`, `app/api/usda-search/`,
  `scripts/optimized-bulk-import.ts`, `scripts/import-popular-foods.ts`,
  `scripts/import.config.json`, `scripts/analyze-usda-data.ts`.

### Mobile phasing step 1 — service extraction + dead-action cleanup (done, 2026-07-13)

First step of the mobile plan below, executed on `main`:

- **`food-actions.ts` overlap resolved: it was entirely dead.** Its only
  page-level consumer (`app/dashboard/food-diary-view.tsx`) was imported by
  nothing, and the whole human-era chain hung off it. Deleted rather than
  ported: `lib/food-actions.ts`, `lib/recipe-actions.ts` (0 importers, as
  scoped), `food-diary-view.tsx`, `components/{meal-section,meal-item-card,
unified-food-search,food-search}.tsx`, `hooks/use-food-actions.ts`, and
  their two test files. Grep-verified zero residual references.
- **Business logic extracted** into plain modules with no Next.js imports —
  each function takes `(supabase, userId, ...)` so a REST route can call it
  identically: `lib/services/dog-service.ts`, `lib/services/meal-service.ts`,
  `lib/services/ingredient-service.ts`. Types (`DogInput`, `DogMealResult`,
  etc.) now live in the services and are re-exported (type-only) from the
  action files, so no call site changed.
- **Actions are now thin wrappers**: `dog-actions.ts` / `meal-actions.ts` /
  `ingredient-actions.ts` keep only guest-mode checks, auth-or-redirect, and
  `revalidatePath`, then delegate. The auth/client helpers they had
  duplicated moved to `lib/server/auth-context.ts` (Next-specific: redirect,
  guest cookie — deliberately kept out of `lib/services/`).
- **Verified**: Jest 134/134; `next build` clean (route manifest unchanged);
  Cypress `dog-nutrition-flow` 3/3 and `bowl-photo-flow` 4/4 against the
  live project. One bowl spec assertion was stale from Phase 3.6 (gate toast
  text changed to "Resolve every item…" in `f120ca4` without updating the
  spec) — fixed; pre-existing, unrelated to this refactor.
- Next: phasing step 2 — add the REST routes wrapping these services.

### Mobile phasing step 2 — REST routes over the services (done, 2026-07-14)

- **Framework decision for `apps/mobile` (Step 4): Vite + React Router, not
  Next.js `output: 'export'`.** Grepped the feature components that would
  move to `packages/features` (`DogMealBuilder`, `NutrientGapBars`,
  `BowlConfirmation`, `DogForm`, `FoodSearch`) — zero `next/navigation` /
  `next/link` / `next/image` imports; the Next-coupling is confined to the
  route-level `*-page.tsx` shells and a few chrome components
  (`app-header`, `guest-mode-button`, `explore-foods-section`). Since a
  static Capacitor shell can't run Next's SSR/middleware/Server Actions
  anyway (the reason raw WebView was rejected in the first place), keeping
  Next for mobile would mean running it with almost none of what it's for.
  Vite is what Capacitor's own React templates use — lighter, faster
  dev/build, no fighting SSR assumptions the shell doesn't need.
- **New REST layer**, all thin wrappers over `lib/services/*` (added last
  session) mirroring the Server Actions one-for-one:
  - `/api/dogs` (GET/POST), `/api/dogs/[dogId]` (GET/PATCH/DELETE)
  - `/api/dogs/[dogId]/meals` (GET/POST), `/api/dogs/[dogId]/gaps` (GET)
  - `/api/meals/[mealId]` (GET/PATCH/DELETE)
  - `/api/ingredients/manual` (POST), `/api/ingredients/branded` (POST)
  - `recipe-actions.ts`/`lib/actions.ts`/`lib/auth.ts` intentionally NOT
    ported, per the original phasing plan (dead code / Supabase client SDK
    covers auth directly).
- **Auth transport**: `lib/server/rest-auth.ts` — these routes read
  `Authorization: Bearer <access_token>` (no browser cookie exists on a
  native client) and validate it via a service-role client's
  `auth.getUser(token)`; ownership is then checked explicitly inside each
  `lib/services/*` call, same pattern `app/api/bowl/analyze` already used.
  `lib/server/service-client.ts` centralizes the service-role client
  construction that was previously ad-hoc per route.
- **Found and fixed a real middleware bug, not just a test artifact**:
  `middleware.ts` gated every non-public/non-guest path on a **cookie**
  session, so any Bearer-token request to the new routes was 307-redirected
  to the HTML `/auth/login` page before reaching the route handler —
  silently defeating the entire point of a REST layer for a client with no
  cookies. Fixed by adding `BEARER_AUTH_ROUTES` (exact prefixes:
  `/api/dogs`, `/api/meals`, `/api/ingredients/manual`,
  `/api/ingredients/branded` — deliberately NOT a blanket
  `/api/ingredients`, since that would have also exposed
  `/api/ingredients/import`, which has no auth check of its own and
  currently relies entirely on this middleware's cookie gate to stay
  non-public).
- **Found and fixed a second real bug, in `lib/services/dog-service.ts` and
  `lib/services/meal-service.ts`**: every existence/ownership-check query
  used `.single()`, which throws Postgrest's raw "no rows" error on a
  genuine miss instead of returning `null` — so the `if (!data) throw new
  Error('...not found')` lines right below every one of them were dead
  code. This was invisible on the web Server Actions (which had no
  HTTP-status mapping to expose the wrong error shape) but surfaced
  immediately as a 500 instead of 404/403 once the REST layer added
  `errorResponse()`'s message-based status mapping. Fixed by switching
  9 existence-check queries (3 in dog-service, 6 in meal-service) to
  `.maybeSingle()`; left the insert/update-returning `.single()` calls
  alone (those always return exactly one row on success). Web behavior is
  unaffected — only the error object shape changed, not the thrown message.
- **`foods.created_by` FK gap — FIXED (2026-07-15)**: it had no `ON DELETE`
  action on its `auth.users` FK (from the original `20250620030000`
  human-nutrition schema, predates PawPlate), so a user who had ever
  created a manual ingredient could never have their auth account deleted —
  Postgres blocked it with a foreign-key violation. Discovered via the new
  Cypress spec's teardown. Migration `20260714010000` re-creates the
  constraint as `ON DELETE SET NULL` (matching `recipes.created_by`;
  CASCADE would be wrong — shared branded/manual rows can be referenced by
  *other* users' `meal_items`, so the ingredient must outlive its creator).
  Applied live and verified end-to-end: created a throwaway user + a
  `foods` row they own, deleted the user with the row still present →
  succeeds, row survives with `created_by = null`. This was the exact
  failure mode behind the stranded e2e test users. Audited the other
  `auth.users` FKs — all already CASCADE or SET NULL; this was the only gap.
  The Cypress `deleteFood` task is kept anyway (keeps orphaned custom-
  ingredient rows from accumulating in the live table), with comments
  updated. `scripts/cleanup-stale-e2e-users.ts` added (dry-run by default,
  `--delete` to act) for the 6 stranded `pawplate.e2e.*` users that were
  still in the live project (since deleted — see below).
- **Verified**: Jest 138/138; `next build` clean (7 new routes in the
  manifest); new `cypress/e2e/mobile-rest-api.cy.ts` (4/4) covers the full
  dog+meal CRUD lifecycle over Bearer-token REST, manual-ingredient
  creation, a 401 with no token, and cross-user ownership (404 on
  owner-filtered reads, 403 on fetch-then-compare updates/deletes — the two
  services differ in exactly *why*, see the fix above). Existing
  `dog-nutrition-flow` (3/3) and `bowl-photo-flow` (6/6) re-verified
  unaffected by the `.maybeSingle()` change.
- Stale `pawplate.e2e.*@example.com` test users from failed runs (their
  cleanup step never ran, blocked by the FK bug above): **deleted from the
  live project (confirmed 2026-07-17)** via
  `scripts/cleanup-stale-e2e-users.ts --delete`.
- **Review hardening (PR #15 follow-up, 2026-07-15):** two issues from the
  code review, both addressed:
  - *Request-body validation at the boundary.* Added `lib/server/rest-schemas.ts`
    (zod schemas mirroring the service input types) and a `readJson()` helper
    in `rest-auth.ts`. Every body-bearing route now parses through it, so a
    malformed/empty body and a well-typed-but-wrong-shape body (e.g.
    `weight_kg: "abc"`, which slipped past the service's `<= 0` check —
    `NaN <= 0` is false — and would have 500'd at Postgres) both return a
    clean 400 instead of a 500. Schemas gate types only; the business rules
    (non-empty name, weight > 0, kcal ≥ 0) stay the single source of truth
    in `lib/services/*`. The parsed type is passed straight into the service,
    so tsc fails the build if a schema drifts from its interface.
  - *404/403 consistency.* Foreign user-owned resources now return 404
    everywhere (was: dogs 404 via `getDog` but PATCH/DELETE + all meal/gaps
    routes 403). 404-for-foreign is the security-conscious default (a
    non-owner can't confirm an id exists) and gives the mobile client one
    predictable code. `dog-service` update/deleteDog are owner-filtered
    (matching getDog); `meal-service`'s 6 ownership checks changed from
    throwing `'Unauthorized'` to `'not found'` (message-only, no query
    change — lowest risk to the shared web query/compute paths; the row is
    still fetched server-side but never returned). Web behavior is unchanged
    in practice — legitimate web flows never touch foreign resources.
  - Tests: `mobile-rest-api.cy.ts` updated (dog cross-user now asserts 404
    across GET/PATCH/DELETE/gaps/meals) and extended with a meal-level
    cross-user test and a malformed/wrong-type body → 400 test. 6/6 live;
    web `dog-nutrition-flow` 3/3 and `bowl-photo-flow` 6/6 re-verified
    unaffected. Jest 138/138, `next build` clean.
- Next: Step 3 (stand up the monorepo — `packages/ui`/`core`/`api-client`,
  move `apps/web` in with no behavior change) or Step 4 (scaffold
  `apps/mobile` with Vite, per the decision above) — whichever the user
  wants to tackle next.

### Mobile phasing step 3 — pnpm/Turborepo monorepo (done, 2026-07-17)

Repo restructured per the "Monorepo layout" plan below, on branch
`feat/monorepo`. No behavior change — verified by the full gate (below).

- **Layout**: pnpm workspaces + Turborepo (root `pnpm-workspace.yaml`,
  `turbo.json`, thin root `package.json`). The entire Next app moved to
  `apps/web/` via `git mv` (history preserved): `app/`, `components/`,
  `hooks/`, `lib/`, `styles/`, `public/`, `scripts/`, `__tests__/`,
  `cypress/`, all configs, and the untracked `.env`/`.env.local`.
  `supabase/` (CLI link + migrations), `docs/`, `audits/` stay at the root.
  The empty `test-utils/` dir was dropped.
- **`packages/core`** — `canine-nutrition.ts`, `types.ts`,
  `dog-toxic-foods.ts` moved in as TS source (Turborepo just-in-time
  style: consumed via `exports` + `transpilePackages`, no build step).
  `apps/web/lib/` keeps three one-line re-export shims, so all ~44
  `@/lib/*` consumer imports are untouched.
- **`packages/ui`** — all 48 `components/ui/*` files plus `lib/utils.ts`
  (`cn`) and the `use-toast`/`use-mobile` hooks; same shim pattern (48
  generated shims in `apps/web/components/ui/`). Package-internal imports
  rewritten to relative. The dead duplicate `use-toast.ts`/`use-mobile.tsx`
  copies that sat inside `components/ui/` (zero importers) were deleted.
  `apps/web/tailwind.config.ts` content globs now include
  `../../packages/ui/src/**` (checked: package-only classes survive the
  production CSS purge).
- **`packages/api-client`** — new typed fetch client over the step-2 REST
  routes (`createPawPlateClient({ baseUrl, getAccessToken })`), method
  shapes mirroring the Server Actions; for `apps/mobile` in step 4.
  Input/result types transcribed locally pending a later move into core.
- **npm→pnpm drift control**: every `"latest"` and range dependency in
  `apps/web/package.json` is now pinned to the exact version the old
  `package-lock.json` had resolved (the switch had silently floated
  `@supabase/supabase-js` 2.50.0→2.110.7, which broke the hand-rolled
  `Database` generic — caught by `tsc`, pinned back). `@jest/globals` is
  now a declared devDep (pnpm's strict layout doesn't hoist it).
- **Real regression found and fixed by the e2e gate**: `packages/ui`'s
  `react: ^19` peer made pnpm materialize a *second* React (19.2.7) peer
  context; Next dedupes React itself via webpack alias, but sonner isn't
  aliased — `toast()` published to one sonner instance while `<Toaster>`
  subscribed on the other, so every toast in the app silently vanished
  (both toast-asserting Cypress tests failed; a `main` worktree run against
  the same live DB passed, proving it was the restructure). Fix: root
  `pnpm.overrides` pins `react`/`react-dom` to 19.1.0 workspace-wide, plus
  a clean reinstall to purge stale webpack-cache resolutions.
- **CI/Vercel**: `ci-cd.yml` switched to pnpm/action-setup + turbo scripts.
  `vercel.json` (now in `apps/web/`) reduced to `{"framework": "nextjs"}` —
  the old `installCommand: "npm install"` would have broken pnpm installs.
  **Manual step required before the next deploy: set Root Directory =
  `apps/web` in the Vercel dashboard** (not expressible in `vercel.json`).
- **Verified**: Jest 173/173, `next lint` clean, `next build` clean (18/18
  pages), `tsc` error set identical to pre-move (only the known
  `nutrition-calculator`/`signup-form` legacy errors), Cypress
  `dog-nutrition-flow` 3/3 + `bowl-photo-flow` 6/6 + `mobile-rest-api` 6/6
  against the live project. The other 6 spec files in `cypress/e2e` are
  legacy NutriTrack-era suites that fail on `main` too — not part of the
  gate; candidates for deletion.
- Next: phasing step 4 — scaffold `apps/mobile` (Vite + React Router +
  Capacitor) consuming `packages/ui`/`core`/`api-client`; optionally move
  shared feature components into a `packages/features`.

### Mobile phasing step 4 — apps/mobile scaffold (2026-07-19)

Branch `feat/mobile-scaffold` (off `main` 8a39fdc, post-monorepo-merge).
First functional slice of the native app: Vite + React 19 + React Router 7
+ Tailwind (same brand tokens as web) + Capacitor 7, consuming
`@pawplate/ui`/`core`/`api-client`.

- **New REST route on the web side: `GET /api/ingredients/search?q=`**
  (`app/api/ingredients/search/route.ts`, + `BEARER_AUTH_ROUTES` entry).
  The web meal builder searches via `/api/foods/unified-search`, which has
  no route-level auth (it relies on middleware's cookie/guest gate), so a
  Bearer-token native client could never reach it. The new route wraps the
  same `fuzzy_search_foods` RPC behind `authenticateRequest()`.
  `@pawplate/api-client` gained `ingredients.search(query)`.
- **`apps/mobile` app structure**: `src/lib/supabase.ts` (client SDK
  session, localStorage persistence — auth deliberately does NOT go through
  the REST layer, per the mobile-strategy notes above), `src/lib/api.ts`
  (`createPawPlateClient` with the session's access token), `AuthProvider`/
  `RequireAuth`, and screens: login, signup, dogs list, dog form
  (create/edit/delete, incl. `bowl_diameter_cm`), dog detail (per-day meals
  + daily kcal + `GapBars` nutrient bars + unsafe-ingredient banner, date
  paging), and a meal builder (debounced ingredient search, gram editing,
  live kcal preview + client-side `findUnsafeIngredients` warning via
  `@pawplate/core` — the server result stays authoritative on save).
- **Theme parity**: `tailwind.config.ts`/`globals.css` mirror apps/web
  (same HSL tokens; keep in sync manually until a shared preset package
  exists). Fonts bundled via `@fontsource/{inter,fraunces}` instead of
  `next/font` — offline-safe inside the Capacitor shell.
- **Capacitor**: `capacitor.config.ts` (`com.pawplate.app`, webDir `dist`),
  `ios/` + `android/` native projects generated and synced (CocoaPods
  1.17.0 installed via Homebrew for iOS; both projects ship Capacitor's
  stock .gitignores, so Pods/build outputs/copied web assets stay out of
  git). Camera plugin NOT wired yet — that's step 4b (bowl-photo flow),
  which also needs the analyze endpoint consumed from the client.
- **Workspace plumbing**: `esbuild` added to `pnpm-workspace.yaml`
  `onlyBuiltDependencies` (vite needs its postinstall); turbo `build` task
  outputs now include `dist/**` and the `VITE_*` env vars. Mobile `lint`
  script is `tsc --noEmit` (no eslint config yet).
- **Env**: `apps/mobile/.env.local` (gitignored) holds `VITE_SUPABASE_URL`
  / `VITE_SUPABASE_ANON_KEY` (same project as web) and `VITE_API_BASE_URL`
  (localhost:3000 for dev; a device needs the LAN IP or the Vercel URL —
  see `.env.example`).
- **Verified**: `turbo run build lint test` 5/5 green (web build/lint/test
  unaffected, mobile build + tsc clean); `mobile-rest-api.cy.ts` extended
  with a search-route test (200 with results, empty-list under 2 chars,
  401 JSON with no token) — 7/7 live; vite dev server serves the app
  (HTTP 200 + module transform OK).
- **CORS for the Bearer routes (added while wiring the simulators)**: the
  shell's WebView origin is `capacitor://localhost` (iOS) /
  `https://localhost` (Android) / `http://localhost:5173` (vite dev), so
  every REST call is cross-origin and the Authorization header forces a
  preflight — which the route handlers (no OPTIONS export) never answered.
  `middleware.ts` now answers OPTIONS with 204 + wildcard CORS headers on
  exactly the `BEARER_AUTH_ROUTES` and stamps the same headers on their
  responses. Wildcard is safe here: these routes carry no cookie auth
  (wildcard forbids credentialed requests anyway), so a foreign page can
  only use them with a token it already holds. Covered by a preflight test
  in `mobile-rest-api.cy.ts` (now 8/8 live).
- **Simulator wiring**: `src/lib/api.ts` rewrites `localhost` →
  `10.0.2.2` at runtime on Android (one dist/ serves both shells);
  `capacitor.config.ts` sets `server.cleartext` +
  `android.allowMixedContent` (dev-only — drop for store builds);
  `android/local.properties` (gitignored) points at `~/Library/Android/sdk`.
- Next: step 4b — bowl-photo flow on mobile (`@capacitor/camera`, consume
  `/api/bowl/analyze` with Bearer auth, port the confirmation UI), then
  step 5 (optionally switch web auth call sites to the client SDK). A
  `packages/features` extraction (sharing DogMealBuilder etc. with
  injected transport) remains optional/deferred.

#### Step 4b checklist — bowl-photo flow on mobile

- [ ] **Backend Bearer auth on `/api/bowl/analyze`.** The route today
      authenticates cookie-only (`getAuthenticatedUserId` reads the session
      cookie) and is NOT in `middleware.ts` `BEARER_AUTH_ROUTES`, so a native
      Bearer caller can't reach it. Add a Bearer fallback to
      `getAuthenticatedUserId` (resolve `data.user` from the
      `Authorization: Bearer` token via the service client, same as
      `authenticateRequest`) and add `/api/bowl/analyze` to
      `BEARER_AUTH_ROUTES` for CORS/preflight. Web cookie + guest flows stay
      untouched (the guest cookie still wins first).
- [ ] **`@pawplate/api-client`: `bowl.analyze()` / `bowl.saveCorrections()`.**
      The existing `request()` helper is JSON-only; analyze is multipart
      (`FormData` with the image), so add a FormData-capable path (no
      `Content-Type` header — let the runtime set the multipart boundary).
- [ ] **Native permission strings** (required before the camera plugin will
      run, and for store review):
  - iOS `apps/mobile/ios/App/App/Info.plist`: `NSCameraUsageDescription`
    AND `NSPhotoLibraryUsageDescription` (the flow allows library pick too).
  - Android `apps/mobile/android/app/src/main/AndroidManifest.xml`:
    `<uses-permission android:name="android.permission.CAMERA" />`.
  - `pnpm add @capacitor/camera` in `apps/mobile`, then `npx cap sync`.
- [ ] **Mobile capture + confirmation UI.** Capture screen (Camera plugin,
      with a library-pick option) → POST to analyze → ported
      `BowlConfirmation` screen (ingredient search, gram confirm, unmatched
      resolve, PATCH corrections). Router entry + a "Log from photo" action
      on the dog-detail screen.
- [ ] **Test:** extend `cypress/e2e/mobile-rest-api.cy.ts` with a Bearer
      analyze case (dog-ownership 404 pre-vision path keeps it Gemini-free).

## Bowl analysis — photo portion estimation (built 2026-07-15, per VISION_MODELS_AND_ESTIMATION.md)

Implements §2.1/2.2 (reference-object + fixed-bowl calibration), §2.4
(correction loop now captures grams), and §2.6 (prompt shoring) from
`VISION_MODELS_AND_ESTIMATION.md`. The model still never outputs weights —
it now LOCALIZES (bounding boxes); grams come from deterministic,
auditable math on our side, and every number the owner sees is flagged as
an estimate to confirm.

- **Fixed-bowl calibration**: `dogs.bowl_diameter_cm` (migration
  `20260715000000`, applied live) — owner measures the bowl's inner rim
  once in the dog form; the bowl then serves as a known-size circular
  reference in every photo. Plumbed through `Dog`/`DogInput`,
  `dog-service`, the REST `DogCreateSchema`, and `components/dog-form.tsx`.
- **Vision schema** (`lib/vision/analyze-bowl.ts`): per-item `box_2d`
  (Gemini convention: [ymin,xmin,ymax,xmax] normalized 0–1000),
  `bowl_box_2d`, and optional `reference_object` (enum `card`|`coin`, with
  real-world sizes STATED in the system prompt — 85.6×54.0 mm card,
  24.26 mm US quarter — per §2.6: models use a stated scale far better
  than an inferred one). `buildUserPrompt` also states the owner-measured
  bowl diameter. Old stored `raw_output` payloads (no boxes) still parse —
  localization fields are optional in the Zod schema.
- **Deterministic estimator** (`lib/vision/portion-estimate.ts`):
  scale resolution prefers owner-measured bowl > coin > card (circular
  references get per-axis cm/unit factors, which cancels the unknown image
  aspect ratio out of area math); box → footprint (×0.75 fill factor) →
  volume (per-category pile-height heuristic) → grams (per-category
  as-served bulk density). Honesty gates: no estimate below 0.6
  identification confidence (§2.6 — route uncertain items to manual
  entry), none for liquids (no visible depth), none outside a 5–1500 g
  sanity clamp; results round to 5 g. The density/height tables are
  authored priors to be recalibrated from correction data.
- **Route** (`app/api/bowl/analyze`): fetches the dog's diameter
  (ownership check upgraded to `getOwnedDog`), attaches `estimated_grams`
  per item and `scale_basis` to all three paths (owner scan, guest scan —
  reference-object only, re-analysis). Estimates persist in
  `identified_items` for the eval story.
- **UI**: estimates prefill the grams inputs in the amber
  owner-confirmable "estimate" state (the total-weight anchor still
  overrides untouched rows — owner-measured total beats photo estimate);
  a notice names the scale source. `/bowl` gained §2.2 capture guidance
  (top-down, set bowl diameter once, or lay a card/quarter flat in frame).
- **Correction loop (§2.4)**: `user_corrected` items now carry `grams`
  (owner ground truth) AND `estimated_grams` (our prediction) — the
  per-category deltas are the calibration signal for refining the density
  tables. No migration needed (jsonb).
- **Verified**: Jest 173/173 (35 new: scale math, categorization, gram
  estimates, schema); Cypress bowl-photo 6/6 (prefill + estimate flag +
  correction-payload grams asserted), dog-nutrition 3/3, mobile-rest-api
  6/6; `next build` clean. Live Gemini smoke against a real 2096²
  dog-bowl photo: new responseSchema accepted, bowl box returned, kibble
  estimated at a plausible 115 g under a 20 cm bowl assumption, 7.4 s.
- **Deliberately deferred**:
  - _Model comparison (doc §1/§4-step-4)_: needs ~20–30 labeled photos
    (now accumulating via the grams-carrying correction loop) AND
    Claude/OpenAI API keys — only Gemini is available today.
  - _V2 stretch goals, explicitly_: LiDAR/depth capture (§2.3 — the
    "correct" long-term fix, fits the Capacitor mobile app phase) and
    ensemble/multi-model voting (§2.5 — doubles inference cost; only if
    the eval set shows single-model identification is the bottleneck).

## Bowl analysis — user-guided/corrective hints (built 2026-07-14)

Implemented per the plan below. The `20260714000000_add_bowl_user_hint.sql`
migration is applied to the live project (confirmed via
`supabase migration list`, 2026-07-15) — the earlier "blocked on manual
push" caveat no longer applies.

What shipped:

- `lib/vision/analyze-bowl.ts` — `AnalyzeBowlInput.userHint` (capped at
  `MAX_USER_HINT_LENGTH` = 500 chars, trimmed) folded into the user turn via
  a new exported `buildUserPrompt()`; system prompt gained a rule: the note
  is ground truth for WHAT is in the bowl (include named items even if
  invisible — low confidence, best-guess proportion), never a source of
  grams/calories.
- `POST /api/bowl/analyze` — optional `hint` form field on both guest and
  owner scans (persisted as `bowl_analyses.user_hint` on the owner path).
  Same POST also now handles **re-analysis**: `analysis_id` + `hint` (no
  image) → ownership check (same rule as PATCH), download the original
  photo from the `bowl-photos` bucket (never trusts client-resupplied
  bytes), re-run the model, update the row in place (latest pass + latest
  hint win). Guests get 401 on this path.
- `/bowl` page — optional "Anything the photo might miss?" textarea sent
  with the upload; `BowlConfirmation` remounts via a `revision` key after
  re-analysis so the row state reseeds from the new items.
- `components/bowl-confirmation.tsx` — "Re-analyze with this note" textarea
  - button inside the "Missed something?" box (parent owns the fetch via an
    `onReanalyze` prop; warns that entered grams reset).
- Tests: 4 new Jest tests for `buildUserPrompt` (138/138 total); Cypress
  `bowl-photo-flow` now 6/6 — happy path asserts the multipart `hint` field
  is sent, plus a stubbed re-analyze flow (asserts `analysis_id` + hint in
  the request and the remounted 2-item list) and a foreign-analysis
  re-analyze → 404 authz test. `next build` clean.
- Eval note: `user_hint` records only the _latest_ hint; the first-pass raw
  output is overwritten on re-analysis. If Phase 6 wants both passes,
  archive to `source_payloads` before update — deferred.

### Original plan (kept for context)

Motivating case (2026-07-14): a real bowl of macaroni + red cabbage + broth
with ground beef and shredded chicken mixed in — Gemini's `analyzeBowlImage`
(`lib/vision/analyze-bowl.ts`) only surfaced the macaroni and cabbage; both
meats were visually indistinct (shredded, submerged in broth) and never
appeared as `items` at all, so the owner had no way to correct an _omission_
— only to fix a wrong label on an item the model did detect.

**Plan:** let the owner attach a short free-text hint alongside the photo,
before or after the first pass, e.g. "there's also ground beef and shredded
chicken in there." Scope:

- **Input UI**: an optional text field on `/bowl` (`app/bowl/`) near the
  photo upload — "Anything the photo might miss? (optional)" — passed
  through `POST /api/bowl/analyze` alongside the image.
- **Prompt wiring**: `analyzeBowlImage` (`lib/vision/analyze-bowl.ts`) gains
  an optional `userHint` param appended to the request's `text` part (same
  pattern as the existing corrective-retry `extraNudge`), instructing Gemini
  to treat the hint as ground truth for items it may have missed and to
  reconcile proportions across the now-complete item set.
- **Post-hoc revision**: since the owner may only notice a miss after seeing
  the confirmation UI (`components/bowl-confirmation.tsx`), also support a
  "re-analyze with a note" action from that screen — re-runs
  `analyzeBowlImage` on the already-uploaded photo with the hint, rather than
  requiring a re-upload. Needs the original image bytes retained (already
  persisted to the `bowl-photos` Storage bucket) or re-fetched by the stored
  `bowl_analyses` row's photo URL.
- **Eval signal**: worth recording whether a hint was used and what it said
  (new nullable column on `bowl_analyses`, or fold into the existing
  `user_corrected` JSON) — feeds Phase 6 (evals/monitoring) as a signal for
  which failure modes (occlusion, mixed/shredded textures, broth-submerged
  items) hints are compensating for, distinct from ordinary mis-labeling.
- Out of scope: the hint never supplies grams or nutrient values — same
  physics-limitation boundary as the rest of the vision pipeline; it only
  helps _identification_, confirmed grams are still owner-entered.

## Calendar view — past-meal history (done, 2026-07-17, branch `feat/calendar-view`)

The dashboard now has a month calendar of each dog's meal history: pick any
past day to view or edit its meals; dot markers indicate days with entries.

- **`components/meal-calendar.tsx`** (new) — "Meal history" card in the
  dashboard's right column. Fetches which days have meals per visible month
  via the new `getDogMealDates(dogId, from, to)`
  (`lib/services/meal-service.ts`, distinct `meals.date` values in range,
  ownership-checked; thin wrapper in `lib/meal-actions.ts`). Future dates
  disabled; markers refresh after a meal is logged or deleted
  (`mealsVersion` counter on the dashboard).
- **Dashboard is date-aware** (`app/dashboard/dashboard-page.tsx`): a
  `selectedDate` state now drives `getDogMeals` / `getDogDailyGaps`, the
  kcal-progress card, nutrient coverage, and the unsafe-ingredient alert.
  Headings switch from "Today's meals" to "Meals on July 12, 2026" when
  off-today, and the meals card shows a "No meals logged…" empty state
  instead of unmounting. Edit/delete of past entries works exactly as for
  today.
- **Backfill logging**: `DogMealBuilder` gained a `date` prop →
  `createDogMeal(..., { date })`, so logging while viewing a past day
  records the meal on that day, not today.
- **`components/ui/calendar.tsx` rewritten for react-day-picker v9**: the
  checked-in shadcn template used the v8 classNames API against the
  installed 9.7.0 and would have rendered unstyled. The component had zero
  importers before this, so nothing else was affected.
- **Timezone fix (latent bug)**: the dashboard previously let the server
  default the date to UTC "today" (`toISOString()`), which flips to
  tomorrow during US evenings; it now always sends the local calendar date
  (`date-fns format`).
- Verified: Jest 173/173, `next lint` clean on all touched files,
  `next build` clean (`/dashboard` in manifest).

## Next phase (planned)

- Phase 5 (pgvector RAG guidance) and Phase 6 (evals/monitoring — which
  consumes the `user_corrected` bowl data now being captured).
- Barcode-scan affordance for branded items (design §5); FatSecret still
  deferred on caching terms.
- Native mobile (camera capture / bowl flow) — see "Mobile strategy" below.
  The Expo `mobile/` app referenced in earlier revisions of this doc was
  removed (`30df066`, superseded by the monorepo + Capacitor plan below;
  never shipped a camera flow).

## Mobile → web parity scope (planned, scoped 2026-07-24)

Goal: bring `apps/mobile` up to feature parity with `apps/web`. Assessed by
diffing web routes/features against mobile screens + the shared
`packages/api-client` surface.

### Already at parity (no work)
Dogs CRUD, meal logging/edit, in-meal ingredient search, nutrient gap bars
(`GapBars`), day-by-day history (prev/today arrows on `DogDetailScreen`),
branded-ingredient accept (in bowl flow), auth + Google SSO. Bowl-photo flow is
on `feat/mobile-bowl-photo-v2` (pending smoke test).

### Gaps, prioritized

**P1 — Foods browse + Food details (biggest true gap).**
- Backend: NONE needed. Routes `/api/foods/unified-search`,
  `/api/foods/nutrient-search`, `/api/foods/[foodId]` already exist and are in
  `GUEST_ALLOWED_ROUTES`, so the mobile client can call them as-is (ingredient
  data is global, not user-scoped).
- `packages/api-client`: add a `foods` namespace — `unifiedSearch(q)`,
  `nutrientSearch(nutrient, min)`, `get(foodId)` + result types.
- Shared helpers already available: `NUTRIENT_LABELS` / `nutrientUnit` live in
  `packages/core/src/canine-nutrition.ts` — reuse, don't re-port.
- Mobile UI: `FoodsScreen` (tabs: text search / nutrient search) + a
  `FoodDetailsScreen` (nutrient breakdown); routes `/foods`, `/foods/:foodId`;
  add a Foods entry to `AppShell` (currently only links `/dogs`).
- Port from `apps/web/app/foods/foods-page.tsx` +
  `apps/web/app/food-details/[foodId]/food-details-view.tsx`.
- Effort: **M** (2 screens + api-client; no backend).

**P2 — Calendar / month history (enhancement over the arrow nav).**
- Backend: NEW. `getDogMealDates(dogId, from, to)` exists as a server action +
  `mealService.getDogMealDates` but has NO REST route. Add
  `/api/dogs/[dogId]/meal-dates?start=&end=` wrapping the service fn, and add it
  to `BEARER_AUTH_ROUTES` in `middleware.ts`.
- `packages/api-client`: `meals.datesForDog(dogId, start, end)`.
- Mobile UI: month calendar with per-day "logged" dots on `DogDetailScreen`
  (replace/augment the arrow nav). `react-day-picker` works in the Capacitor
  web runtime — port `apps/web/components/meal-calendar.tsx`.
- Effort: **M** (1 REST route + api-client + calendar UI).

**P3 — Optional / product decisions (not strictly parity).**
- Guest mode on mobile: web allows guest browse; mobile `RequireAuth` forces
  login. Decide whether an installed app should offer guest mode at all
  (many app-store apps skip it). Effort S–M if wanted.
- Cross-dog dashboard/home hub: web `/dashboard` is a single-page hub; mobile
  uses a dogs-list model that's arguably better for touch. Optional. Effort M.
- Manual ingredient creation UI: api-client `ingredients.createManual` exists;
  verify it's surfaced in the mobile meal builder (web has it). Effort S.

### Sequencing & cross-cutting
Do P1 → P2 → (P3 by decision). Each new screen needs a route in
`apps/mobile/src/App.tsx` + a nav affordance in `AppShell`. Keep local-date
handling consistent with the bowl/meal `localToday()` fix (meals log under LOCAL
date, not UTC). Reuse `GapBars` and the `packages/core` nutrition helpers.

## Cleanup backlog (collated 2026-07-25) — do on a separate branch

Housekeeping deliberately deferred so it wouldn't muddy feature diffs. None of
it blocks shipping; grouped roughly by value. Suggested branch: `chore/cleanup`.

### A. TypeScript debt (the reason this list exists)
`apps/web/next.config.mjs` sets **`typescript: { ignoreBuildErrors: true }`**, so
type errors never fail the build and have accumulated silently. `pnpm --filter
web exec tsc --noEmit` currently reports (all pre-existing on `main`, unrelated
to the mobile work):
- `components/signup-form.tsx` (~L47/L49) — reads `state.success`, but `signUp`
  in `lib/actions.ts` only ever returns `{ error }` or redirects, so the success
  banner is **unreachable dead code**. Either add a `success` return path or
  delete the branch.
- `lib/nutrition-calculator.ts` (~6 errors, L15–L22) — `NutritionData` fields are
  optional but assigned to a `Required<...>` type and then arithmetic'd, so
  `totals.calories` etc. are possibly-`undefined` → **risk of `NaN` downstream**.
  Real correctness issue, worth fixing properly rather than casting.
- **Goal:** fix the above, then flip `ignoreBuildErrors` to `false` so the build
  gate keeps it clean. Do this LAST in the cleanup branch.

### B. Dead / stale dependencies + docs
- `@supabase/auth-helpers-nextjs@0.10.0` is in `apps/web/package.json` with
  **zero imports** anywhere, and its transitive `@supabase/auth-helpers-shared`
  shows in pnpm's deprecation warnings. Remove the dependency.
- This doc's "mobile phasing" section still says `lib/recipe-actions.ts` (0 call
  sites) should be "flagged for deletion" and that `lib/food-actions.ts` needs an
  overlap review — **both files are already deleted**. Update that prose so it
  stops describing work that's done.

### C. Mobile bundle size
`apps/mobile` builds a single ~545 KB JS chunk and Vite warns past its 500 KB
limit. Route-level `React.lazy` + `Suspense` (BowlPhotoScreen is 558 lines and
only used on one route; FoodDetailsScreen likewise) would cut first-load cost on
a phone. Low risk, real UX win on cold start.

### D. Pre-store-build hardening (must happen before submission, not before merge)
- `apps/mobile/capacitor.config.ts` still sets `server.cleartext: true` and
  `android.allowMixedContent: true` — dev-only affordances for the plain-http
  local API. Drop both and build against the https deployment.
- iOS equivalent is already clean: `NSAppTransportSecurity` has been removed from
  `Info.plist` (restore snippet is in a comment there if local cleartext dev is
  needed again).
- Re-enable **Vercel Deployment Protection** on preview deployments if it isn't
  needed for device testing anymore — it was disabled to let the native app
  reach preview URLs (see the mobile testing notes).
- Add the Play **app-signing** SHA-1 to the Google OAuth Android client after the
  first `.aab` upload, or production Google sign-in fails with `DEVELOPER_ERROR`.

### E. Test housekeeping
- `apps/web/cypress/e2e/dashboard-meal-tracking.cy.ts:129` ("should allow
  navigation back to dashboard") was previously left failing and has since been
  softened to assert only `url().should('not.include', '/food-details')`, with a
  note that App Router lands guests on `/landing`. **Verify it actually passes
  now**, then either restore a meaningful assertion or document why the weak one
  is correct.
- No specs are `.skip`-ed — the suite is otherwise honest.

## Mobile strategy (planned) — monorepo + Capacitor

**Decision:** build native iOS/Android via **Capacitor wrapping a shared
React codebase**, not the old Expo `mobile/` app (removed) and not "load the
live Vercel URL in a bare WebView" (rejected — see below). Not started;
scoping only, on `main` as of 2026-07-13.

### Why not just point a WebView at the hosted site

Considered and rejected as the primary approach:

- No offline capability — a network blip is a blank screen, not a degraded
  app.
- App-store risk: Apple has a history of rejecting apps that are
  functionally just a website in a WebView with no native behavior
  (Review Guideline 4.2/4.7 territory) — this app would have no native
  plugin usage at all under that approach.
- Auth fragility: `@supabase/ssr` relies on httpOnly cookies; WKWebView
  storage is less durable than native keychain storage and can be purged
  under iOS storage pressure, causing silent logouts that don't happen on
  web.
- No perceived-native speed — every navigation round-trips to the server.

### Why the app is a good fit for a shared-codebase approach anyway

Checked the current `main` codebase to scope this: **every top-level page
(`dashboard`, `dogs`, `foods`, `bowl`) is already a thin server wrapper
(metadata only) around a `'use client'` page component** — the actual UI
(`DogMealBuilder`, `NutrientGapBars`, `BowlConfirmation`, etc.) already runs
entirely client-side and calls the 7 `lib/*-actions.ts` files as RPCs. That
means most component/JSX code doesn't need to change for a native build —
only the transport under the action calls does.

### The real scope: 7 `'use server'` files → REST endpoints

Server Actions can't run inside a Capacitor-bundled static shell (no Node
process on-device), so each exported action needs an equivalent API route.
Inventoried every export and its current call-site count:

- `lib/meal-actions.ts` (4 call sites) — `createDogMeal`,
  `getDogMealForEdit`, `updateDogMeal`, `getDogDailyGaps`, `getDogMeals`,
  `deleteDogMeal` → `/api/dogs/:dogId/meals` (GET/POST),
  `/api/meals/:mealId` (GET/PATCH/DELETE), `/api/dogs/:dogId/gaps`.
- `lib/dog-actions.ts` (5 call sites) — `createDog`, `getUserDogs`, `getDog`,
  `updateDog`, `deleteDog` → `/api/dogs` (GET/POST), `/api/dogs/:id`
  (GET/PATCH/DELETE).
- `lib/ingredient-actions.ts` (1 call site) — `createManualIngredient`,
  `acceptBrandedIngredient` → new routes alongside the existing
  `app/api/ingredients/import` route.
- `lib/food-actions.ts` (3 call sites) — `searchFoods`, `getTodaysMeals`,
  `addFoodToMeal`, `updateMealItem`, `deleteMealItem`, `createMeal`,
  `deleteMeal`. **Needs a look before porting** — this predates the
  dog-centric pivot (human-meal shape) and may be partially superseded by
  `meal-actions.ts`; confirm which of the 3 call sites are live UI vs.
  dead paths before writing routes for it.
- `lib/recipe-actions.ts` (**0 call sites**) — dead code as of this scoping
  pass. Skip porting; flag for deletion instead unless a caller turns up.
- `lib/actions.ts` (`signIn`/`signUp`/`signOut`, form-action pattern) and
  `lib/auth.ts` (session helpers) — **don't port these to REST at all**.
  Supabase's client-side JS SDK can call `signInWithPassword` /
  `signUp` / session management directly over HTTPS from any client,
  mobile included. Simpler than adding an auth REST layer, and it's the
  one part of the current design that's already fully portable as-is.

Business logic stays a single source of truth: extract the DB
query/mutation body of each action into a plain (non-`'use server'`)
function; the existing Server Action becomes a thin wrapper around it (web
keeps `revalidatePath`/SSR benefits unchanged), and the new API route
handler wraps the same function for mobile. No duplicated logic, two thin
callers.

Auth/guest-route gating currently lives in `middleware.ts`
(`GUEST_ALLOWED_ROUTES`) — that still runs for the web app unchanged.
Mobile re-implements the same allow-list as a client-side check (RLS
remains the actual enforcement boundary either way, per the existing
comment in `middleware.ts`).

### Monorepo layout (proposed)

```
pawplate/                      # pnpm workspaces + Turborepo
├── apps/
│   ├── web/                   # current Next.js app, ~unchanged: SSR,
│   │                          #   Server Actions, middleware, Vercel deploy
│   └── mobile/                # Next.js (output: 'export') or Vite shell
│                              #   + Capacitor ios/ and android/ native projects
├── packages/
│   ├── ui/                    # components/ui (shadcn/Radix) + Tailwind preset
│   ├── features/              # DogMealBuilder, NutrientGapBars,
│   │                          #   BowlConfirmation, etc. — shared as-is
│   ├── core/                  # lib/canine-nutrition.ts, lib/types.ts, zod schemas
│   └── api-client/            # typed fetch wrappers matching today's action
│                              #   signatures (createDogMeal(...), getDogDailyGaps(...))
│                              #   so call sites barely change
```

`apps/web`'s API routes (added per the porting list above) double as the
REST backend both apps talk to — no separate backend deploy needed.

### Native-only work Capacitor doesn't remove

- Bowl-photo capture: swap the existing (web `<input type="file">`-based?
  needs confirming) capture path for the Capacitor `Camera` plugin —
  this is new native code regardless of monorepo structure, and it's the
  one piece of genuine native behavior that also helps the app-store-review
  concern above.
- Native back-button handling on Android (hardware back → in-app history,
  not app close).
- CI matrix roughly doubles (web + iOS + Android build/signing).

### Pre-release hardening (not blockers for the MVP)

- **Token storage.** The mobile app already uses the Supabase JS SDK with
  the default WebView `localStorage` (`apps/mobile/src/lib/supabase.ts`) —
  it never used cookies, so there is no cookie→native "swap" to do. Not
  necessary for a functional build; it's a reliability/security hardening:
  - _Durability:_ iOS (WKWebView) can evict website data under storage
    pressure → silent logout. Fixed by passing a custom `auth.storage`
    adapter backed by `@capacitor/preferences` (survives eviction).
  - _Security at rest:_ the refresh token in `localStorage` is app-sandboxed
    but not encrypted. `@capacitor/preferences` does NOT fix this (plain
    UserDefaults on iOS); real at-rest encryption needs a Keychain/Keystore
    plugin (e.g. `@aparajita/capacitor-secure-storage`).
  - Either way it's a ~1-file change (custom `storage` object on
    `createClient`'s `auth` options); schedule before store submission.

### Suggested phasing

1. Extract shared business-logic functions out of the 5 live action files
   (skip `recipe-actions.ts`, resolve `food-actions.ts` overlap first).
2. Add the REST routes wrapping those functions; keep Server Actions as
   thin wrappers calling the same functions (web unaffected).
3. Stand up the monorepo (`packages/ui`, `packages/core`,
   `packages/api-client`) and move `apps/web` into it with no behavior
   change — proves the restructure alone doesn't regress anything.
4. Add `apps/mobile` (static export/Vite shell) consuming
   `packages/features` + `packages/api-client`; wire Capacitor + native
   Camera plugin for the bowl-photo flow.
5. Switch `lib/actions.ts` auth call sites (web included, optionally) to
   the Supabase client SDK directly.

## Supabase integration (done)

New project: **`pawplate`**, ref `stdqdzvhexqgodpuriaw`, region `us-east-1`,
org `AnthonyM5's Org` (`psogkumezbgjobnjozlp`). Created and configured via
the Supabase CLI (v2.26.9, already authenticated in this environment).

1. **Created the project:**

   ```sh
   supabase projects create pawplate --org-id psogkumezbgjobnjozlp \
     --region us-east-1 --db-password <generated>
   supabase link --project-ref stdqdzvhexqgodpuriaw
   ```

   (`us-east-2`, the old project's region, is no longer offered for new
   projects — valid regions are listed by `supabase projects create --help`.)

2. **Fixed a pre-existing migration-ordering bug before pushing.** The
   consolidated base migration `20250620030000_create_nutrition_schema.sql`
   does **not** include `scripts/005_add_extended_nutrients.sql` or
   `scripts/006_add_fuzzy_search.sql` — those only ever existed as
   manually-run scripts. They're now proper timestamped migrations:
   `20250620030100_add_extended_nutrients.sql`,
   `20250620030200_add_fuzzy_search.sql`. Separately,
   `20250119000000_add_recipes.sql` was timestamped _before_ the base schema
   migration that creates the `foods`/`meal_items` tables it has foreign
   keys into — on a truly empty database (unlike the old project, which had
   these tables from manual application) this ordering fails outright. Fixed
   by renaming it to `20250620030300_add_recipes.sql`, after its
   dependencies. Also removed a stray duplicate
   `20250620030000_create_nutrition_schema.sql.backup` file that isn't a
   valid migration filename and was being silently skipped by the CLI.
   Full applied order:

   ```
   20250620030000_create_nutrition_schema.sql
   20250620030100_add_extended_nutrients.sql
   20250620030200_add_fuzzy_search.sql
   20250620030300_add_recipes.sql
   20260706000000_pawplate_schema.sql
   20260706000100_seed_nutrient_requirements.sql
   20260706000200_seed_dog_ingredients.sql
   20260707000000_create_bowl_photos_bucket.sql
   ```

3. **Pushed via `supabase db push`** — all 8 migrations applied cleanly to
   the fresh project in one pass.

4. **Storage bucket:** `scripts/013_create_bowl_photos_bucket.sql` (mirrored
   as a migration) creates `bowl-photos` — public read, 10 MB limit,
   image/jpeg|png|webp|gif only, with RLS-style storage policies
   (authenticated insert, service-role full access). Verified present via
   `storage.buckets`.

5. **Env vars updated** in `.env.local` and `.env` (both gitignored, never
   committed) with the new project's URL, anon key, and service-role key —
   fetched via `supabase projects api-keys` and written directly into the
   files without ever printing the key values to the terminal/transcript.
   `GEMINI_API_KEY` and `NEXT_PUBLIC_USDA_API_KEY` were untouched (still
   valid, unrelated to the Supabase migration).

6. **Types regenerated:** `supabase gen types typescript --linked >
lib/database.types.ts`. This file is **not currently imported anywhere**
   — the app's hand-maintained `Database` type lives in `lib/types.ts` and
   is what `lib/supabase/{client,server}.ts` actually use. Spot-checked the
   generated shapes for `dogs`, `nutrient_requirements`, `bowl_analyses`,
   and the canine columns on `foods` against `lib/types.ts` — they match.
   Treat `lib/database.types.ts` as a reconciliation reference, not a live
   import, unless/until something is switched over to it.

   > **Superseded (2026-07-27):** nothing was ever switched over, so
   > `apps/web/lib/database.types.ts` was deleted in the cleanup pass. The
   > hand-maintained `Database` type in `apps/web/lib/types.ts` remains the
   > only one. Regenerate on demand rather than keeping a stale copy in git:
   > `supabase gen types typescript --linked > /tmp/database.types.ts` and
   > diff it against `lib/types.ts`.

7. **Verified end-to-end against the live project:**
   - `psql` via the pooler connection: all 10 expected tables present, RLS
     enabled on every one, 50 nutrient-requirement rows (25 adult + 25
     puppy), 38 ingredients (7 toxic-flagged), `fuzzy_search_foods('chiken
liver', 3)` returns the right matches despite the typo.
   - `npm run dev` boots clean against the new project (no connection/auth
     errors in the server log).
   - `GET /api/foods/unified-search?q=chicken` (with the `guestMode` cookie
     to clear the auth-required middleware) returned real seeded rows
     (`Chicken heart, raw`, etc.) via the service-role client — confirms the
     app's actual query path works against the new database, not just raw
     `psql`.

### Production status (updated 2026-07-17)

- **Done**: env vars set in Vercel — production deploys and runs properly
  against the live `pawplate` project.
- **Done**: `GEMINI_API_KEY` rotated (the earlier chat-exposed key is dead).
- **Done**: stale `pawplate.e2e.*` test users deleted from the live project.
- Remaining: add `NEXT_PUBLIC_SUPABASE_URL`/keys and `GEMINI_API_KEY` to CI
  if tests ever need live Supabase (current Jest suite doesn't hit the
  network).
- Nutrition guidance is presented with generic informational disclaimers
  rather than any claim of professional review: a global
  not-veterinary-advice footer (`app/layout.tsx`) plus the per-dog
  consult-your-vet notice (`requiresVetNotice`) on recommendation surfaces.

## Key caveats

- Gram estimation from photos is out of scope for v1 — owners enter weights.
- USDA taurine/amino coverage is incomplete; affected ingredients carry
  `is_verified = false`.
- Requirement values are a reference model (AAFCO 2016 transcription). All
  guidance is informational only — not veterinary advice, diagnosis, or
  treatment. The UI carries a global disclaimer footer and the
  consult-your-vet notice on every recommendation surface.
