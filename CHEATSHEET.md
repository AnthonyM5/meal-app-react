# PawPlate Cheatsheet

Quick reference for working in this repo day-to-day. For the product overview
and architecture, see [README.md](./README.md). For the full history of how
the monorepo/mobile migration happened, see
[docs/PAWPLATE_PROGRESS.md](./docs/PAWPLATE_PROGRESS.md).

---

## Repo layout (pnpm + Turborepo monorepo)

```
pawplate/
├── apps/
│   ├── web/        # Next.js 15 app — the original app, now workspace-scoped
│   └── mobile/     # Vite + React + Capacitor — iOS/Android shell
├── packages/
│   ├── core/       # @pawplate/core — canine-nutrition engine, types, dog-toxic-foods
│   │                 (pure TS: no Next.js, no Supabase client, no network)
│   ├── ui/          # @pawplate/ui — shared shadcn/Radix components, cn(), hooks
│   └── api-client/ # @pawplate/api-client — typed fetch wrappers over apps/web's
│                     mobile REST routes (Bearer-token auth); used by apps/mobile
├── supabase/migrations/   # Shared Postgres schema for both apps — single
│                           source of truth; apply with `supabase db push`
└── turbo.json / pnpm-workspace.yaml
```

> If you cloned this repo _before_ the monorepo migration, you may still have
> root-level `app/`, `components/`, `hooks/`, `lib/` directories sitting on
> disk. They are **not tracked in git** and not part of the workspace — a
> fresh clone won't have them. The real web app lives at `apps/web/app` etc.

> `apps/web/scripts/` holds only TypeScript data/maintenance scripts. The
> numbered `.sql` files that used to live there were snapshots of migrations
> that already exist under `supabase/migrations/` — schema changes go in a
> new timestamped migration, never in `scripts/`.

**Package manager is pnpm, not npm.** Root `package.json` declares no runtime
dependencies (only `turbo` as a devDependency) — every task (`build`, `dev`,
`lint`, `test`) is a `turbo run <task>` that fans out to whichever workspace
package defines it.

```bash
pnpm install                 # installs for the whole workspace
pnpm dev                     # turbo run dev — starts web + mobile dev servers
pnpm --filter web dev        # just the Next.js app
pnpm --filter mobile dev     # just the Vite dev server
pnpm --filter web exec <cmd> # run an arbitrary command scoped to one package
```

`pnpm-workspace.yaml` approves lifecycle scripts for `cypress` and `esbuild`
only (pnpm 10 blocks postinstall scripts by default) — add a package there if
a new dependency's postinstall silently doesn't run.

---

## New features (since the last README pass)

- **Mobile app (`apps/mobile`)** — Capacitor-wrapped React/Vite shell for
  iOS + Android. Talks to `apps/web`'s REST routes (`/api/dogs`, `/api/meals`,
  `/api/bowl/analyze`, …) via `@pawplate/api-client`, authenticated with a
  Supabase session Bearer token (no server-side session/cookies on mobile).
- **Google Sign-In (native)** — `@capgo/capacitor-social-login` on mobile;
  opens the OS account picker, hands the ID token to
  `supabase.auth.signInWithIdToken`. See [Mobile setup](#mobile-app-setup)
  for the 3-client-ID dance this requires.
- **Mobile bowl photo v2** — native Capacitor Camera capture, on-device
  confirmation UI reusing `@pawplate/core`'s `computeMealNutrients` /
  `findUnsafeIngredients`, scale-basis reference (bowl diameter / coin / card)
  for gram estimation, food detail screens on mobile.
- **Shared `@pawplate/core` package** — the deterministic nutrition engine
  and dog-safety data were extracted out of `apps/web/lib` so both apps
  import the exact same pure functions (no duplicated nutrient math).
- **Shared `@pawplate/ui` package** — shadcn/Radix components centralized so
  web and mobile render the same design system; web consumes it via
  `transpilePackages` in `next.config.mjs`, mobile via plain Vite/TS resolve.
- **Normalized food catalogue** — the USDA bulk import took `foods` to 5,029
  rows, which broke search (everything scored 1.00 and sorted alphabetically:
  `'beef'` returned *"Beans, baked, canned, with beef"*). Search now uses a
  fitted relevance blend, prepared foods are pruned, duplicates merged, and
  4,700 active rows roll up into **1,409 canonical groups** — so `'beef'`
  returns 8 groups instead of 960 rows. See
  [`docs/DATA_NORMALIZATION_DESIGN.md`](docs/DATA_NORMALIZATION_DESIGN.md).
- **Bowl analysis requires an explicit lean/fat choice** — the vision model
  reports "ground beef" and cannot see the ratio, but that spans 121–332
  kcal/100 g. Ambiguous items now block logging until the owner picks a
  variant. Analysis is also a manual button press after choosing a photo, so
  the hint can be written with the photo visible.

For the deeper feature set (fresh-feeding nutrient engine, guest mode, fuzzy
search, etc.) see the [README's Features section](./README.md#features).

---

## Key pnpm packages by app

### `apps/web` (Next.js 15 / React 19)

| Package                                                   | Why it's here                                           |
| --------------------------------------------------------- | ------------------------------------------------------- |
| `next`, `react`, `react-dom`                              | App Router, Server Actions                              |
| `@supabase/ssr`, `@supabase/supabase-js`                  | Auth + Postgres client (cookie-based session)           |
| `@radix-ui/*`, `class-variance-authority`, `cmdk`, `vaul` | shadcn primitives (also re-exported via `@pawplate/ui`) |
| `react-hook-form`, `@hookform/resolvers`, `zod`           | Forms + schema validation                               |
| `recharts`                                                | Dashboard nutrient/energy charts                        |
| `@pawplate/core`, `@pawplate/ui`                          | workspace packages                                      |

### `apps/mobile` (Vite / React 19 / Capacitor)

| Package                                                                     | Why it's here                                     |
| --------------------------------------------------------------------------- | ------------------------------------------------- |
| `vite`, `@vitejs/plugin-react`                                              | Dev server + bundler (not Next.js)                |
| `@capacitor/core`, `@capacitor/ios`, `@capacitor/android`, `@capacitor/cli` | Native shell + platform projects                  |
| `@capacitor/camera`                                                         | Bowl photo capture                                |
| `@capgo/capacitor-social-login`                                             | Native Google Sign-In                             |
| `react-router`                                                              | Client-side routing (no Next.js router on mobile) |
| `@supabase/supabase-js`                                                     | Auth session (Bearer token, no `@supabase/ssr`)   |
| `@pawplate/core`, `@pawplate/ui`, `@pawplate/api-client`                    | workspace packages                                |

### `packages/*`

| Package                | Exports                                                                         |
| ---------------------- | ------------------------------------------------------------------------------- |
| `@pawplate/core`       | `.`, `./canine-nutrition`, `./types`, `./dog-toxic-foods`                       |
| `@pawplate/ui`         | `./lib/utils`, `./hooks/use-toast`, `./hooks/use-mobile`, `./*` (any component) |
| `@pawplate/api-client` | `.` — `createPawPlateClient({ baseUrl, getAccessToken })`, `ApiError`           |

---

## Web setup (local)

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # then fill in real values
```

`apps/web/.env.local` — the full reference (`.env.local` takes precedence over
`.env` in Next.js; the names below are exact, and a mismatched name fails
silently at runtime — the bowl route just returns a 503):

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # server-only; bowl analysis + imports
GEMINI_API_KEY=...                   # server-only; bowl photo vision
NEXT_PUBLIC_USDA_API_KEY=...         # ingredient imports

# Optional — guest bowl-scan metering
GUEST_RATE_LIMIT_SALT=...            # falls back to the service-role key
GUEST_BOWL_DAILY_LIMIT=3             # guest scans per IP per day

# Optional
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

```bash
supabase link --project-ref <your-project-ref>
supabase db push                     # applies the full migration chain

pnpm --filter web dev                # http://localhost:3000
```

Web tests:

```bash
pnpm --filter web test               # Jest
pnpm --filter web test:coverage
pnpm --filter web cypress            # Cypress UI, against an already-running server

# E2E — these hit the LIVE Supabase project with throwaway pawplate.e2e.* users,
# so the server env must be loaded first.
set -a && source apps/web/.env.local && set +a
pnpm --filter web test:e2e           # boots `next dev`, opens the Cypress UI
pnpm --filter web test:e2e:headless  # boots `next dev`, runs headless
pnpm --filter web test:e2e:ci        # boots `next start` (needs a prior build) — what CI runs
env -u ELECTRON_RUN_AS_NODE pnpm --filter web exec cypress verify

```

Prefer `test:e2e:ci` when reproducing a CI failure: `next dev` compiles each
route on first request (a cold `/dashboard` took ~17s in CI), which blows past
Cypress's 10s assertion timeout and makes the first test to hit a route flake.

---

## Mobile app setup

The mobile app is a thin client — all business logic and data live in
`apps/web`'s REST API. You need `apps/web` running (locally or deployed)
before the mobile app is useful.

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

`apps/mobile/.env` (Vite env, **not** `.env.local`):

```env
VITE_SUPABASE_URL=...                # same Supabase project as apps/web
VITE_SUPABASE_ANON_KEY=...
VITE_API_BASE_URL=http://localhost:3000   # or your machine's LAN IP for a real device
VITE_GOOGLE_WEB_CLIENT_ID=...        # optional — only if testing Google Sign-In
VITE_GOOGLE_IOS_CLIENT_ID=...
```

```bash
pnpm --filter web dev                # apps/web must be up first
pnpm --filter mobile dev             # Vite dev server, browser preview
```

### Running on a simulator/device (Capacitor)

```bash
pnpm --filter mobile build           # outputs apps/mobile/dist
pnpm --filter mobile exec cap sync   # copies dist/ + plugins into ios/ and android/

pnpm --filter mobile exec cap open ios       # opens App.xcworkspace in Xcode
pnpm --filter mobile exec cap open android   # opens the project in Android Studio
```

Notes:

- **Android emulator reaches the host as `10.0.2.2`, not `localhost`** —
  `apps/mobile/src/lib/api.ts` rewrites this automatically at runtime, so
  `VITE_API_BASE_URL=http://localhost:3000` works on both platforms during dev.
- `capacitor.config.ts` sets `server.cleartext: true` and
  `android.allowMixedContent: true` so plain-http dev API calls aren't
  blocked. **Drop both before a store build** and point `VITE_API_BASE_URL`
  at an `https` origin.
- Every REST route the mobile app calls lives under `apps/web/app/api/`
  (`/api/dogs`, `/api/meals`, `/api/bowl/analyze`, `/api/foods/...`) and is
  authenticated by a `Bearer <supabase access token>` header — see
  `apps/web/middleware.ts` for how those routes are told apart from the
  cookie-authenticated web routes.

### Google Sign-In setup (native)

Requires **three** Google Cloud OAuth client IDs:

1. **Web application** client → `VITE_GOOGLE_WEB_CLIENT_ID`. This is the
   token _audience_ — it must also be added under Supabase Dashboard → Auth →
   Providers → Google → "Authorized Client IDs".
2. **iOS** client → `VITE_GOOGLE_IOS_CLIENT_ID`. Its **reversed** value
   (`com.googleusercontent.apps.XXXX`) must be added to
   `ios/App/App/Info.plist` under `CFBundleURLTypes`.
3. **Android** client — register the app's SHA-1 fingerprint in the Cloud
   console; no env var needed on that side.

Two failure modes that are easy to hit and hard to diagnose:

- **The web client ID must come FIRST** in Supabase's combined "Client IDs"
  field (it's one comma-separated field holding all three). Supabase uses the
  first entry to derive the OAuth redirect, so putting the iOS or Android ID
  first makes _web_ login fail with `redirect_uri_mismatch` while native keeps
  working.
- **Production Android needs a second SHA-1.** Play re-signs your `.aab` with
  its own app-signing key, so the SHA-1 from your local keystore isn't the one
  that ships. After the first upload, copy the app-signing SHA-1 from Play
  Console → Setup → App integrity into the Android OAuth client, or production
  sign-in fails with `DEVELOPER_ERROR` even though debug builds work.

Implementation: `apps/mobile/src/lib/socialAuth.ts` (`initSocialAuth`,
`signInWithGoogle`) + `apps/mobile/src/components/GoogleSignInButton.tsx`.

---

## Common commands

```bash
pnpm build                  # turbo run build (all apps/packages)
pnpm lint                   # turbo run lint
pnpm test                   # turbo run test

pnpm --filter web <script>      # scope any script to apps/web
pnpm --filter mobile <script>   # scope any script to apps/mobile
pnpm --filter @pawplate/core <script>  # scope to a package by its package name
```

### Food-catalogue maintenance (`apps/web/scripts/`)

All need service-role env and are run from `apps/web`. The mutating ones are
**dry-run by default** and write a report to `audits/` — read it before
passing `--apply`.

```bash
cd apps/web && set -a && source .env.local && set +a

npx tsx scripts/023_search_relevance_check.ts          # search relevance gate
npx tsx scripts/024_prune_prepared_foods.ts [--apply|--revert]
npx tsx scripts/025_merge_duplicate_foods.ts  [--apply]
npx tsx scripts/026_build_canonical_ingredients.ts [--apply] [--reset]
npx tsx scripts/027_audit_canonical_merges.ts          # merge-threshold gate
```

Two of these are **verification gates that exit non-zero**, and both should be
run after any change to search ranking or `lib/food-name-parser.ts`:

- **`023`** asserts named relevance expectations against the live
  `fuzzy_search_foods` RPC (18/18 today). The Jest suite deliberately never
  hits the network, so it cannot test SQL ranking — this is the only thing
  that catches a ranking regression.
- **`027`** replays the canonical matcher's **silent** ≥0.90 auto-merges
  (`canonical_review_queue` only records the 0.75–0.90 band a human reviews)
  and fails if the merged and kept-apart populations overlap.

`026` is fully recomputable — `--apply --reset` rebuilds the canonical layer
from scratch, so parser fixes are cheap to land. Nothing here ever hard-deletes
a `foods` row; see [`DATA_NORMALIZATION_DESIGN.md`](docs/DATA_NORMALIZATION_DESIGN.md) §3.3
for why that would destroy logged meals.

---

## CI/CD (`.github/workflows/ci-cd.yml`)

- Runs on every push/PR to `main` via pnpm (10.12.1) + Node 20, `pnpm
install --frozen-lockfile`.
- `test` job: `pnpm lint`, `pnpm test`, `pnpm build`.
- `build` job (push to `main` only): production build.
- `cypress` job: builds `apps/web` in production mode (`next start`, not
  `next dev` — avoids first-request compile jank blowing past Cypress's
  10s timeout), runs the e2e suite against the live Supabase project with
  throwaway `pawplate.e2e.*` users, sweeps them up in an `always()` step.
