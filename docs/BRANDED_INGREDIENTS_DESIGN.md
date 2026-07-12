# Branded Ingredients & Multi-Source Nutrient Resolution — Design Draft

_Draft 2026-07-08. Companion to `NUTRIENT_API_SOURCING_AND_AUDIT.md` §2 (sourcing
hierarchy) and §4.2 (vision normalization fallback chain). Not yet implemented._

## 1. Problem

The bowl-scan and meal flows currently normalize every label against the `foods`
table via `fuzzy_search_foods`, which is populated only from **USDA whole foods** +
hand-curated ingredients. Two real cases break this:

1. **Branded products.** A scan of the reference bowl (The Farmer's Dog "Jada's Turkey
   Recipe") yields `ground turkey / chickpeas / lentils / carrot / broccoli / bell
   pepper` (USDA-resolvable) **plus the branded fresh food itself**, which has no USDA
   entry and never will. Same for a store-bought bone broth, a commercial topper, a
   specific kibble.
2. **Owner intent.** Owners want to log **toppers and mix-ins** — commercial products
   added to a fresh bowl — in both the bowl flow and manual meal builder.

USDA is the wrong source for these; branded/barcoded databases (Open Food Facts, then
FatSecret) are. This doc designs how branded data coexists with the deterministic
USDA-backed engine **without compromising the engine's trustworthiness.**

## 2. Design principles

- **The deterministic engine stays the trust anchor.** Branded data is lower-fidelity
  (crowd-sourced, macro-heavy, micro-sparse). It must never silently degrade the
  nutrient-gap math that today runs on verified USDA rows.
- **Source is first-class and visible.** Every ingredient carries where it came from;
  the UI shows it. Owners should see "USDA verified" vs "branded — limited data."
- **Missing ≠ zero.** This is the crux (see §6). A branded topper with no reported
  taurine must read as *unknown*, not `0`, or gap percentages become lies.
- **Fallback, never replace.** Resolution order is USDA → OFF → FatSecret → manual.
  A branded match is only used when USDA has nothing.

## 3. Data model changes

### `foods` table
Add:

| Column | Type | Purpose |
|---|---|---|
| `source` | `text` / enum | `'usda' \| 'curated' \| 'off' \| 'fatsecret' \| 'manual'`. Today implied by `fdc_id`; make it explicit. |
| `barcode` | `text` (nullable, unique) | EAN/UPC — dedupe key for branded products. |
| `off_id` / `external_id` | `text` (nullable) | Source's own product id (OFF code, FatSecret food_id). |
| `source_attribution` | `text` (nullable) | Required credit string (ODbL — see §7). |
| `is_complete_food` | `boolean` default false | True for branded **complete meals** (e.g. Farmer's Dog) logged as a single line item, not decomposed into ingredients. |
| `data_completeness` | `text` / enum | `'full' \| 'macros_only' \| 'sparse'` — drives the "missing ≠ zero" logic and UI. |

**Nutrient columns stay the same shape** (per 100 g). The `NOT NULL DEFAULT 0` on the
canine nutrient columns is the problem for branded data — see §6 for the fix (nullable
or a companion "reported" bitmap).

### New: `ingredient_sources` provenance (optional, pairs with §3.4 raw-JSON persistence)
Store the raw OFF/FatSecret JSON response keyed by `foods.id`, same pattern recommended
for USDA in the audit doc §3.4, so re-derivation never needs a re-fetch.

## 4. Resolution flow (the fallback chain)

The vision normalizer (`normalizeLabel` in `app/api/bowl/analyze/route.ts`) and the
meal-builder search both route through one shared resolver:

```
resolveIngredient(label | barcode):
  1. USDA-backed fuzzy_search_foods(label)        → if match ≥ threshold, done (source=usda/curated)
  2. barcode present? → Open Food Facts by barcode → cache into foods (source=off), done
  3. Open Food Facts name search (branded)         → if confident match, cache, done
  4. FatSecret search (LATER — key pending)        → cache (source=fatsecret), done
  5. no match                                       → return unresolved → UI prompts manual entry
```

- Steps 2–3 **cache the result into `foods`** on first resolution so the second owner
  who logs the same product gets an instant local hit (and so `fuzzy_search_foods`
  picks it up thereafter). Respect source caching terms (OFF: fine; FatSecret: verify
  first — see §8).
- Step 5's **manual entry is the terminal guarantee**: products in *no* database
  (Farmer's Dog is DTC subscription — may not be in OFF) must still be loggable. Owner
  enters name + grams + whatever macros are on the label; row saved `source='manual'`,
  `data_completeness='sparse'`.

## 5. Flow integration

### Bowl flow
- **Label path (default).** Unresolved labels from the vision model no longer just show
  "no match — pick manually." They first attempt OFF name search; if a branded candidate
  is found it's offered as a match option ("Looks like: The Farmer's Dog Turkey Recipe —
  branded, limited data").
- **Barcode path (new, optional, high-value).** Add a "scan the package barcode" affordance
  in the confirmation UI for any unresolved item. Barcode → OFF by-barcode is far more
  reliable than name matching for branded goods. Cheap to add (same camera the bowl flow
  already uses).

### Meal flow (manual builder)
- `use-ingredient-search` already searches `foods`; once branded items are cached there,
  they surface automatically. Add a **source badge** to results ("USDA" / "Branded") and
  a barcode-scan entry point so owners can add a topper without a photo.
- **Complete foods** (`is_complete_food=true`) log as a single line with their own
  per-100g profile — not decomposed. A Farmer's Dog serving is one item, not
  turkey+chickpeas+…

## 6. The "missing ≠ zero" correctness fix (most important)

Today `extractCanineNutrients` and the `foods` schema default every unreported nutrient
to `0`. For verified USDA foods that's fine (they report ~all tracked nutrients). For a
branded topper reporting only kcal/protein/fat/carbs, defaulting taurine/amino acids/
vitamins to `0` would make gap analysis compute a **falsely low** intake and flag
phantom deficiencies — or worse, average a topper's fake zeros into an otherwise
adequate bowl.

**Fix options (decision needed):**
- **(A) Nullable nutrient columns + null-aware gap math.** A `null` means "not reported";
  gap analysis treats a nutrient as *unknown* for that food and either excludes it from
  that nutrient's total (showing "incomplete — N items lack data") or flags the whole
  bowl's coverage for that nutrient as unmeasurable. Most correct; larger change (the
  engine currently assumes numbers).
- **(B) A `reported_nutrients` bitmap/array per food.** Keep columns `0`-defaulted but
  record which were actually reported; gap math consults the bitmap. Less invasive to
  existing math, adds a parallel structure to maintain.

**✅ Decided (§11): Option (A)** — nullable columns; missing is `null`, never `0`. And
per decision #2, **branded items are excluded from micronutrient gap math entirely** —
so branded data never enters the deterministic engine regardless. The nullable change
still matters for honest per-food display and for any *curated/USDA* row that happens to
lack a nutrient. Branded items ship for **calorie/macro** logging; their micronutrients
are shown as *not counted* in gap analysis, and the bowl surfaces "partial coverage" for
nutrients a branded item doesn't report.

## 7. Licensing — Open Food Facts (ODbL)

OFF data is under the **Open Database License (ODbL)**. Two obligations that affect us:

- **Attribution** — must credit Open Food Facts wherever its data appears. Plan: a
  per-item source line ("Nutrition data © Open Food Facts contributors, ODbL") on any
  branded ingredient detail, plus a general credit in the app's about/legal page.
- **Share-alike** — ⚠️ **needs a decision, possibly legal review.** ODbL share-alike
  attaches to a *Derivative Database* that is *publicly distributed*. Using OFF data to
  power the app (a "Produced Work") requires attribution; the sharp edge is that caching
  OFF rows into `foods` creates a derivative database, and if we ever **publicly
  redistribute that database** (export, public API, data dump) the share-alike clause
  could require releasing it as open data. Powering our own app UI is generally fine
  with attribution; redistribution is where it bites. **Confirm the intended use against
  the ODbL before shipping**, and keep OFF-sourced rows tagged (`source='off'`) so they
  can be isolated/excluded from any future data export.

Source: [OFF API docs](https://openfoodfacts.github.io/openfoodfacts-server/api/),
[OFF data & license](https://world.openfoodfacts.org/data),
[OFF forum: conditions to use the API](https://forum.openfoodfacts.org/t/conditions-to-use-the-open-food-facts-api/443).

## 8. FatSecret (deferred — key being provisioned)

- Slots in as **step 4** of the resolver, after OFF, as a second-opinion matcher and for
  branded items OFF lacks. OAuth 2.0 (client_id/secret + token refresh layer).
- ⚠️ **Blocker to verify before building:** FatSecret's terms historically **restrict
  persisting their data** long-term. If confirmed, FatSecret can only be a *live,
  uncached* per-request lookup — it cannot cache into `foods` like OFF can. That changes
  its integration shape (resolve-on-demand, don't store). **Read current caching terms
  at signup before writing the integration.** Until the key + terms are confirmed, the
  resolver's step 4 is a no-op stub.

## 9. OFF → canine nutrient mapping

OFF `nutriments` reliably provides per-100g: `energy-kcal`, `proteins`, `fat`,
`carbohydrates`, `fiber`, `sugars`, `salt`/`sodium`, and *sometimes* calcium, iron, a
few vitamins. It **rarely** provides the canine-critical micros (taurine, amino acids,
most minerals/vitamins). So:
- Branded OFF rows land as `data_completeness='macros_only'` (or `'sparse'`),
  `is_verified=false`.
- The extractor for OFF is a **separate, smaller mapper** (`lib/off-integration.ts`),
  not the USDA one — different response shape, different field names, unit conversions
  (OFF `salt` g → sodium mg via /2.5, energy already kcal).
- Everything unreported is `null` under §6 option (A), *not* 0.

## 10. Phased plan

1. **Schema** ✅ **done** — migration `20260709000000_add_branded_ingredient_columns.sql`
   adds `source`, `barcode` (already existed), `external_id`, `source_attribution`,
   `is_complete_food`, `data_completeness`; backfills `source` from `fdc_id`; drops
   `DEFAULT 0` on the micronutrient columns (the schema half of "missing ≠ zero").
   **Migration is committed but NOT yet applied to prod — it applies on merge** (this
   branch is for PR review/testing first).
2. **"Missing ≠ zero" + branded exclusion** ✅ **done** — `computeMealNutrients` now skips
   null values and excludes branded micros, returning `{ totals, coverage }`;
   `computeGaps` takes `coverage` and marks a nutrient `unmeasured` when every contributor
   was excluded (branded-only bowl no longer reads as "deficient in everything"). The
   engine is backward-compatible: called without `coverage`, behavior is unchanged. Fully
   unit-tested (`__tests__/lib/canine-nutrition.test.ts`).
3. **OFF integration** — ⚙️ **mapper slice done (2026-07-10)**: `lib/off-integration.ts`
   ships `fetchOFFByBarcode` / `searchOFFByName` / `convertOFFToIngredient` with a CLI
   smoke harness (`scripts/021_test_off_mapper.ts`, dry-run by default). Two findings
   from live testing: (a) pet products resolve on **Open Pet Food Facts**
   (`world.openpetfoodfacts.org`, same API/license) — lookups try OPFF first, then OFF,
   and attribution is set per-host; (b) products with no reported kcal are not
   convertible (`calories_per_serving` is NOT NULL) — the mapper returns null and the
   raw payload is still archived to `source_payloads`. Remaining from this step: the
   shared resolver (steps 2–3 of §4) and automatic caching into `foods`. (next)
4. **Bowl flow** — OFF fallback on unresolved labels + optional barcode-scan affordance.
5. **Meal flow** — source badges, barcode entry, complete-food single-line logging.
   Also: gap UI needs an `unmeasured`/"partial coverage" treatment (new GapStatus).
6. **FatSecret** — resolver step 4, once key + caching terms confirmed.
7. **Attribution/legal** — credit UI + ODbL share-alike decision recorded.

## 11. Decisions (resolved 2026-07-08)

1. **"Missing ≠ zero" approach** → **✅ Option (A): nullable nutrient columns.** Missing
   nutrient data is stored as `null`, never coerced to `0`.
2. **Branded items in micronutrient gap math** → **✅ Excluded.** Branded (OFF/FatSecret)
   ingredients are logged for calorie/macro tracking and shown in bowls, but their sparse
   micronutrient data is **not** fed into the deterministic gap engine. A bowl containing
   a branded item shows its micronutrient coverage as *partial/unmeasurable* for the
   affected nutrients rather than computing a false total.
3. **ODbL** → **✅ Apply `source='off'` tag** to all OFF-sourced rows (keeps them isolable
   from any future data export; pair with the attribution credit line). Share-alike
   revisited only if public redistribution of `foods` is ever pursued.
4. **Complete branded foods** (Farmer's Dog) → **✅ Single line item** (`is_complete_food`),
   not decomposed. A dedicated logging flow for these will be built separately.

### Still open / deferred
- **Barcode scanning affordance** — not decided; names-only OFF resolution can ship first,
  barcode capture added later.
- **FatSecret** — deferred until key + caching terms confirmed (§8).
