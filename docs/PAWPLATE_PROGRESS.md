# PawPlate — Implementation Progress & Production Plan

Status as of 2026-07-07, branch `feat/pawplate`. Tracks the phases from the
PawPlate handoff plan. Everything below was built and tested **locally only** —
the old Supabase instance expired, so production deployment starts from a
fresh Supabase project (see Production Deployment).

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
- Verified on local Postgres (Postgres.app) with a stubbed `auth` schema:
  full migration chain applies cleanly, RLS enabled on all tables,
  `fuzzy_search_foods` works (handles typos), re-apply is idempotent.

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

### Test/build state
- `npm test`: 107/107 passing. `next build`: compiles.
- Pre-existing (not from this work): tsc errors in `mobile/` (deps not
  installed), `components/signup-form.tsx`, `lib/nutrition-calculator.ts`,
  and the Next 15 async-params error in `.next/types` (build has
  `ignoreBuildErrors: true`).

## Not started
- Phase 4 UI (bowl confirmation → meal), camera capture in `mobile/`.
- Phase 5 (pgvector RAG guidance) and Phase 6 (evals/monitoring).
- Dashboard rework to per-dog nutrient gaps (UI still the human tracker).
- Cypress specs for dog/meal/bowl flows.

## Production deployment plan (fresh Supabase project)

1. **Create the Supabase project**, then set env vars locally and in Vercel:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_USDA_API_KEY` (or `USDA_API_KEY`),
   `GEMINI_API_KEY` (server-side only).
2. **Link and push migrations** (order matters; the base schema must include
   extended nutrients + fuzzy search before the PawPlate migration):
   ```sh
   supabase link --project-ref <ref>
   # ensure scripts/005 + 006 content is present as migrations on fresh setups,
   # then:
   supabase db push        # applies supabase/migrations/*
   ```
   Note: `20250620030000_create_nutrition_schema.sql` does not include
   005 (extended nutrients) or 006 (fuzzy search). On a fresh project run
   those two scripts (SQL editor or convert to timestamped migrations) before
   `20260706000000_pawplate_schema.sql`.
3. **Create the `bowl-photos` storage bucket** (public read or signed URLs).
4. **Regenerate types**: `supabase gen types typescript --linked > lib/database.types.ts`
   and reconcile with `lib/types.ts`.
5. **Import ingredients**: seed files ship 38; then use
   `POST /api/ingredients/import` for more (service-role key required).
6. **Verify RLS** with two test users (dogs/meals/bowl_analyses isolation).
7. **Before any public claim**: veterinary review of
   `011_seed_nutrient_requirements.sql` values; keep the consult-your-vet
   notice (`requiresVetNotice`) wired into every recommendation surface.

## Key caveats
- Gram estimation from photos is out of scope for v1 — owners enter weights.
- USDA taurine/amino coverage is incomplete; affected ingredients carry
  `is_verified = false`.
- Requirement values are a reference model (AAFCO 2016 transcription), not a
  substitute for a board-certified veterinary nutritionist.
