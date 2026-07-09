# PawPlate — Implementation Progress & Production Plan

Status as of 2026-07-07, branch `feat/pawplate`. Tracks the phases from the
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
- `scripts/010_pawplate_schema.sql` (mirrored at
  `supabase/migrations/20260706000000_pawplate_schema.sql`): `dogs`,
  `nutrient_requirements`, `bowl_analyses` tables with RLS; canine nutrient
  columns on `foods`; `meals.dog_id` + `meals.source`; `weight_logs.dog_id`;
  drops `water_intake` / `exercise_logs`; `fdc_id` made nullable (hand-curated
  ingredients have no USDA id). Idempotent — safe to re-apply.
- **Decision:** the physical table stays named `foods`; the TS layer exposes it
  as `Ingredient` (avoids breaking the USDA importer and `fuzzy_search_foods`).
- Seeds: `011_seed_nutrient_requirements.sql` (50 rows, AAFCO 2016 per-1000-kcal
  values, adult + puppy; **transcribed values — needs veterinary review before
  production claims**) and `012_seed_dog_ingredients.sql` (38 ingredients incl.
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
- If a cooked FDC analog ever doesn't exist: USDA's *Nutrient Retention
  Factors* (Release 6) + *Cooking Yields for Meat and Poultry* tables are
  the deterministic fallback — but measured entries always win.

### Meal editing + food browse/search (done, 2026-07-07)
Two user-requested capabilities plus a canine rebuild of the old food
detail page.
- **Edit logged meals** — `getDogMealForEdit` (loads a meal's items with
  full ingredient rows; ownership checked via the `dogs!inner` join) and
  `updateDogMeal` (replaces items/grams/meal type, recomputes and returns
  fresh gaps; deletes-then-reinserts `meal_items` with the *old* items kept
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
  never mounted in any layout, so *every* `toast()` call in the app was
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
  verifies the caller **owns the `dog_id`** on POST (checked *before* reading
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
  `011_seed_nutrient_requirements.sql`, needs vet review**) applied live.
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
- **Audit AC status**: #1 ✅, #3 ✅, #4 ✅ done. **Remaining**: #2 (30-staple
  raw/cooked gap table — larger, needs a staple list + classifier) and #5
  (raw-JSON persistence, §3.4). OFF/FatSecret fallback sources (§2) not started.
- **Deferred**: §3.4 raw `format=full` JSON persistence before extraction, so
  future nutrient-map expansions and non-nutrient field adds don't require
  re-fetching from USDA — the structural fix that would also make AC #4's
  recommended fields cheap to capture. Flagged for a future session.

## Next phase (planned)
- Phase 5 (pgvector RAG guidance) and Phase 6 (evals/monitoring — which
  consumes the `user_corrected` bowl data now being captured).
- Camera capture / bowl flow in the Expo `mobile/` app (web flow done).
- Persist raw USDA `format=full` responses before extraction (audit doc §3.4).
- Vet review of all AAFCO-sourced `nutrient_requirements` values (25 original
  + 12 new amino-acid/B-vitamin rows).

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
   `20250119000000_add_recipes.sql` was timestamped *before* the base schema
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

### Remaining production steps (not yet done)
- Set the same env vars in Vercel (or wherever this deploys) — currently
  only local `.env.local`/`.env` were updated.
- Add `NEXT_PUBLIC_SUPABASE_URL`/keys and `GEMINI_API_KEY` to CI if tests
  ever need live Supabase (current Jest suite doesn't hit the network).
- Create a real test user and exercise `dog-actions.ts`/`meal-actions.ts`
  through actual sign-up + login, not just guest-mode/service-role paths.
- Import more ingredients beyond the 38 seeded ones via
  `POST /api/ingredients/import` (needs `USDA_API_KEY` + service role).
- **Before any public claim:** veterinary review of
  `011_seed_nutrient_requirements.sql` values; keep the consult-your-vet
  notice (`requiresVetNotice`) wired into every recommendation surface.
- Rotate the `GEMINI_API_KEY` currently in `.env.local` — it was shared in
  plaintext during this session's chat, so treat it as exposed.

## Key caveats
- Gram estimation from photos is out of scope for v1 — owners enter weights.
- USDA taurine/amino coverage is incomplete; affected ingredients carry
  `is_verified = false`.
- Requirement values are a reference model (AAFCO 2016 transcription), not a
  substitute for a board-certified veterinary nutritionist.
