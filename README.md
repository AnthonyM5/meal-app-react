# PawPlate

Fresh-feeding nutrition platform for dogs — photograph a bowl, get a deterministic AAFCO-referenced nutrient gap analysis.

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

> ⚠️ **Not veterinary advice.** Nutrient requirements are a transcription of the AAFCO 2016 profiles and have not been reviewed by a board-certified veterinary nutritionist. Every recommendation surface carries a consult-your-vet notice.

## Overview

PawPlate helps owners who cook fresh food for their dogs answer one hard question: **is this bowl actually balanced?** Owners log a meal — by photo or by hand — and the app computes energy requirements and per-nutrient gaps against life-stage-appropriate targets.

The core design constraint: **no LLM ever touches the nutrient math.** A vision model identifies *what's in the bowl*; a deterministic engine computes *what that means*.

### Features

- **Bowl photo analysis** — snap a photo, a vision model identifies ingredients and rough proportions, the owner confirms grams, and the meal is logged. Corrections are persisted as an evaluation signal.
- **Deterministic canine nutrition engine** — RER/MER energy math, per-1000-kcal AAFCO target resolution across 37 tracked nutrients, gap classification (deficient / adequate / excess / toxic-risk / unmeasured), and Ca:P ratio balance.
- **Toxic-ingredient safety layer** — cited ASPCA/FDA/Merck list (alliums, grapes, xylitol, chocolate, macadamia…) surfaced *before* any math runs.
- **Dog profiles** — weight, ideal weight, life stage, activity level, neuter status, health conditions → individualized daily energy targets.
- **Ingredient database** — USDA FoodData Central import with raw/cooked preparation-state awareness, plus hand-curated entries USDA doesn't carry.
- **Fuzzy ingredient search** — typo-tolerant trigram search, plus search-by-nutrient ("find foods high in lysine").
- **Guest mode** — browse ingredients without an account.

### Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Server Actions
- **Backend**: Supabase — PostgreSQL, Auth, Row-Level Security, Storage
- **Styling**: Tailwind CSS + Radix UI (shadcn), Fraunces/Inter type system
- **Vision**: Google Gemini (`gemini-2.5-flash`) with a structured `responseSchema` + Zod validation
- **Data**: USDA FoodData Central API; Open Food Facts / FatSecret planned for branded products
- **Testing**: Jest (business logic), Cypress (E2E)
- **Deployment**: Vercel

---

## Architecture

### The LLM boundary

This is the most important design decision in the codebase.

```
Bowl photo ──▶ Gemini vision ──▶ { labels, proportions, confidence }
                                          │
                                          ▼
                            fuzzy_search_foods (pg_trgm)
                                          │
                                          ▼
                              Owner confirms grams  ◀── the human is the sensor
                                          │
                                          ▼
                     lib/canine-nutrition.ts  (pure functions, no network)
                                          │
                                          ▼
                          Energy targets + per-nutrient gaps
```

The vision model returns **labels and rough proportions only — never grams.** Estimating mass from a single 2D image is not something a model can do reliably, so the app doesn't pretend otherwise: the owner supplies weight, and the model supplies identification. Model output is Zod-validated with one corrective retry.

The nutrient engine (`lib/canine-nutrition.ts`) is pure and network-free, so results are reproducible and unit-testable.

### "Missing ≠ zero"

Nutrient data is heterogeneous: USDA whole foods report ~everything, branded products report almost nothing. Treating an *unreported* nutrient as `0` fabricates deficiencies. So:

- Unreported nutrients are `null`, never coerced to `0`.
- `computeMealNutrients` returns `{ totals, coverage }` — coverage records, per nutrient, how many items actually contributed data.
- A nutrient with no trustworthy contributor is classified **`unmeasured`**, not `deficient`.
- Branded (Open Food Facts / FatSecret) ingredients contribute **calories and macros only**; their sparse micronutrient data is excluded from gap math entirely.

### Authorization

`/api/bowl/analyze` uses a service-role Supabase client that bypasses RLS, so it performs its own authorization: dog ownership is verified **before** the upload is read or the vision model is called. Middleware only guarantees a session exists — it can't stop user A from passing user B's `dog_id`.

### Fuzzy ingredient search

1. **`pg_trgm` extension** for trigram text similarity — tolerates typos and partial matches.
2. **GIN index** on `foods(name, brand)` for fast trigram lookups.
3. **`fuzzy_search_foods` SQL function** encapsulates ranking in the database layer.
4. **Supabase RPC** invokes it from the Next.js backend.
5. **`/api/foods/unified-search`** serves the UI.

A companion `search_foods_by_nutrient` RPC powers nutrient search. It's **SQL-injection safe**: the column name is validated against `information_schema` before `format(%I)` interpolation, and the API route independently allowlists against the tracked-nutrient set.

---

## Development Setup

### 1. Install

```bash
git clone <repository-url>
cd meal-app-react
npm install
```

### 2. Environment

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key   # server-only; bowl analysis + imports
GEMINI_API_KEY=your_gemini_api_key                # server-only; bowl photo analysis
NEXT_PUBLIC_USDA_API_KEY=your_usda_fdc_key        # ingredient imports
```

> `.env.local` takes precedence over `.env` in Next.js. The variable names above are exact — a mismatched name fails silently at runtime (the bowl route returns a 503).

### 3. Database

```bash
supabase link --project-ref <your-project-ref>
supabase db push          # applies the full migration chain
```

Migrations create the `dogs`, `nutrient_requirements`, and `bowl_analyses` tables, the canine nutrient columns on `foods`, RLS policies, seed data (AAFCO requirements + curated ingredients), and the `bowl-photos` storage bucket.

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
meal-app-react/
├── app/
│   ├── bowl/                # Photo capture → confirmation → meal
│   ├── dashboard/           # Dog selector, energy progress, nutrient gaps
│   ├── dogs/                # Dog profile management
│   ├── foods/               # Ingredient browse + nutrient search
│   ├── auth/ landing/       # Authentication & marketing
│   └── api/
│       ├── bowl/analyze/    # Vision pipeline (POST) + corrections (PATCH)
│       ├── foods/           # unified-search, nutrient-search
│       └── ingredients/     # USDA import
├── lib/
│   ├── canine-nutrition.ts  # ⭐ Deterministic engine — no network, no LLM
│   ├── vision/analyze-bowl.ts # Gemini call + Zod schema validation
│   ├── usda-canine.ts       # FDC nutrient extraction (verified IDs)
│   ├── dog-toxic-foods.ts   # Cited toxic-ingredient matcher
│   ├── dog-actions.ts       # Server actions
│   └── meal-actions.ts
├── audits/                  # USDA data-sourcing audit deliverables
├── docs/                    # Progress log + design docs
├── scripts/                 # Import + audit scripts
└── supabase/migrations/     # Timestamped migration chain
```

---

## Data Sourcing & Audits

Nutrient data quality is the product. The [`audits/`](./audits/) directory holds checked-in, regenerable evidence:

| File | What it proves |
|---|---|
| `usda-nutrient-coverage.{md,json}` | Live diff of mapped vs. available FDC nutrients across a 20-food sample. No AAFCO-required canine nutrient is silently dropped. |
| `usda-food-coverage.md` | Corpus coverage %, plus a raw/cooked variant gap table across all staples. |
| `usda-nonnutrient-fields.md` | Explicit keep/discard decision for every non-nutrient FDC field. |
| `pawplate-staple-ingredients.md` | ~33 source-backed fresh-feeding staples (AKC / FDA / PetMD / Hill's), with canine caveats. |

Known limitations are documented rather than hidden — e.g. **taurine is not reported by FDC at all**, so it comes from curated data; imports with sparse profiles are marked `is_verified = false`.

See [`docs/BRANDED_INGREDIENTS_DESIGN.md`](./docs/BRANDED_INGREDIENTS_DESIGN.md) for the multi-source resolution chain (USDA → Open Food Facts → FatSecret → manual).

---

## Scripts

```bash
npm run dev              # Development server
npm run build            # Production build
npm run start            # Production server
npm run lint             # ESLint
npm run test             # Jest unit tests
npm run test:coverage    # With coverage
npm run cypress          # Cypress UI
npm run test:e2e         # Server + Cypress
```

Data scripts (require `set -a && source .env.local && set +a`):

```bash
npx tsx scripts/import-cooked-ingredients.ts     # Cooked USDA variants
npx tsx scripts/019_audit_raw_cooked_gaps.ts     # Raw/cooked coverage audit (read-only)
```

---

## Testing Strategy

### Unit & business logic (Jest)

Pure functions and data transformations — the things that must be right.

- `canine-nutrition.test.ts` — energy math, target resolution, gap classification, branded exclusion, `unmeasured` coverage
- `usda-canine.test.ts` — FDC nutrient extraction, unit conversion, preparation-state inference
- `analyze-bowl.test.ts` — vision schema validation and retry behavior
- `meal-calculations.test.js`, `nutrition-calculator.test.ts`, `utils.test.js`

### End-to-end (Cypress)

Real user flows against a real database, with throwaway users created via the admin API.

- `bowl-photo-flow.cy.ts` — photo → confirmation → meal logged as `source: 'photo'`, plus three authorization tests (foreign dog, missing `dog_id`, foreign analysis)
- `dog-nutrition-flow.cy.ts` — dog creation, meal logging/editing, nutrient search
- `auth-flow.cy.ts`, `food-search*.cy.ts`, `dashboard-meal-tracking.cy.ts`, `responsive-design.cy.ts`, `error-handling.cy.ts`

The Gemini call is stubbed via `cy.intercept` so the suite is deterministic and free, while the confirmation step still exercises the real `createDogMeal` server action.

```bash
set -a && source .env.local && set +a
npx cypress run
```

### Philosophy

- **Business logic gets unit tests**; React render details don't.
- **Integration coverage lives in Cypress**, against real auth and RLS.
- **Authorization is tested, not assumed** — every service-role route has a negative test.

---

## Roadmap

- Open Food Facts integration for branded toppers and mix-ins (schema + null-aware engine landed; resolver next)
- pgvector RAG layer for interpretive guidance
- Vision evals consuming the `user_corrected` signal
- Persist raw USDA API responses so nutrient-map expansion never requires a re-fetch
- Veterinary review of the AAFCO requirement seed values before any public claim
