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
- Not yet built: confirmation UI (adapt `components/recipe-builder.tsx`),
  meal creation from confirmed analysis, camera capture.

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

## Not started
- Phase 4 UI (bowl photo → confirmation → meal), camera capture in
  `mobile/`. This plugs into the meal path built above (a confirmed bowl
  attaches to a dog's meal via `createDogMeal` with `source: 'photo'`).
- Phase 5 (pgvector RAG guidance) and Phase 6 (evals/monitoring).

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
