# Data Normalization, Dedupe & Search — Design Draft

_Draft 2026-07-29. Companion to [`BRANDED_INGREDIENTS_DESIGN.md`](./BRANDED_INGREDIENTS_DESIGN.md)
(which covers *provenance* and *branded* rows) and [`../audits/usda-food-coverage.md`](../audits/usda-food-coverage.md)
(which covers *corpus coverage*). This doc covers what happens **after** the corpus
got big: normalizing names, collapsing variants, and making search usable._

## 1. What changed, and why this is now urgent

`scripts/022_bulk_import_usda_wholefoods.ts` has been run against the live
`pawplate` project. The `foods` table is no longer 61 curated rows:

| Slice | Rows |
|---|---|
| Total | **5,029** |
| `source='usda'` | 4,985 |
| `source='curated'` | 38 |
| `source='manual'` | 2 |
| `source='off'` | **0** |
| `is_verified=true` | 4,621 |
| `is_safe_for_dogs=false` | 147 |
| `barcode IS NOT NULL` | **0** |

Corpus coverage went from 0.28% to ~61% of the whitelisted Foundation + SR
Legacy corpus. The `usda-food-coverage.md` audit is stale and should be
regenerated.

**Every problem below is a consequence of that import.** None of it was
visible at 61 rows.

### 1.1 Search is broken today (highest-severity finding)

`fuzzy_search_foods` scores with
`GREATEST(similarity(name,q), similarity(brand,q), word_similarity(q,name))`.
`word_similarity(q, name)` returns **1.0 whenever the query appears as a word
extent anywhere in the name** — which, at 5,029 long USDA descriptions, is
almost everything. The score saturates, so the effective ordering collapses to
the last tiebreak: **`f.name` alphabetically.**

Live results (service-role, prod DB, 2026-07-29):

```
=== "beef" ===
1.00 [usda]    Beans, baked, canned, with beef          ← alphabetically first
1.00 [usda]    Beef composite, separable lean only, trimmed to 1/8" fat, choice, cooked
1.00 [curated] Beef heart, raw
1.00 [usda]    Beef, Australian, imported, grass-fed, ground, 85% lean / 15% fat, raw
...

=== "rice" ===
1.00 [usda] Noodles, chinese, cellophane or long rice (mung beans), dehydrated
1.00 [usda] Oil, rice bran
1.00 [usda] Pasta, gluten-free, brown rice flour, cooked, TINKYADA
...            ← actual rice appears below the noodles and the oil
```

This also degrades the bowl auto-resolver: `matchLocalIngredient` takes
`match_limit: 1` and accepts anything ≥ `MATCH_THRESHOLD` (0.3). With the score
pinned at 1.00 it now confidently auto-matches **the alphabetically first row
containing the label**. "beef" in a bowl photo resolves to *baked beans with
beef*. The `is_safe_for_dogs=false` guard still holds, but wrong-nutrient
matches are silent.

The `20260712000200` migration that introduced `word_similarity` was correct
for its era (61 rows, single-word labels under-scoring). It is wrong at 5,029.

### 1.2 Variant explosion

First comma-token distribution:

| Base token | Rows |
|---|---|
| beef | **958** |
| pork | 329 |
| lamb | 297 |
| chicken | 208 |
| fish | 204 |
| beans | 141 |
| veal | 108 |
| turkey | 106 |

958 beef rows differ only in cut / grade / trim / prep / country of origin:

```
Beef, Australian, imported, grass-fed, loin, tenderloin steak/roast, boneless, separable lean and fat, raw
Beef, Australian, imported, grass-fed, loin, tenderloin steak/roast, boneless, separable lean only, raw
Beef, Australian, imported, Wagyu, loin, tenderloin steak/roast, boneless, separable lean and fat, Aust. marble score 4/5, raw
```

An owner adding "beef" to a bowl does not need to choose between Wagyu marble
score 4/5 and marble score 9. Name lengths run to 13 comma segments
(histogram: 1 seg=79 rows, 4=880, 6=659, 8=583, 10+=90).

### 1.3 Real duplicates

52 names (case-insensitive) appear more than once — **56 redundant rows**:

```
3×  blueberries, raw
3×  garlic, raw
3×  lamb, ground, raw
3×  yogurt, plain, whole milk
2×  beef, ground, 80% lean meat / 20% fat, raw
2×  chicken, broiler or fryers, breast, skinless, boneless, meat only, cooked, braised
```

Two distinct causes:
- **Within USDA**: Foundation and SR Legacy both describe the same food, and
  SR Legacy itself carries near-identical rows. `fdc_id` is unique so the
  upsert can't catch these.
- **Cross-source**: the 38 hand-curated rows now shadow their USDA
  equivalents — curated `Beef liver, raw` vs USDA `Beef, liver, raw`. These
  don't collide on exact name, so they're *not* in the 56; they're a larger
  hidden set that only fuzzy matching finds.

### 1.4 Category whitelist leakage

`CATEGORY_WHITELIST` admits whole FDC categories, and two of them carry
non-dog-relevant contents:

- `Fats and Oils` → **58 `salad dressing, …` rows**, 79 `oil, …`
- `Dairy and Egg Products` → 89 `cheese, …`, 48 `milk, …`

Salad dressings are prepared products, not fresh-feeding ingredients. They
pollute search and inflate the corpus.

## 2. Design principles

Carried forward from `BRANDED_INGREDIENTS_DESIGN.md` §2, plus:

- **Normalize, never destroy.** Variant rows keep their full USDA description
  and nutrients. Normalization adds a grouping layer on top; it does not
  rewrite or delete source data. A user who *wants* Wagyu marble score 9 can
  still reach it.
- **Rule-based first, ML only for the residual.** The USDA description grammar
  is a controlled vocabulary. Deterministic parsing is cheap, debuggable, and
  (per Valsesia et al. 2018, *Frontiers in Nutrition*) fuzzy matching alone
  hits >96% precision on food-name mapping — ML added nothing to precision
  there.
- **Search relevance is a product feature, not an index tuning detail.** The
  ranking function needs test coverage with named expectations, not just "it
  returns rows."
- **Only ODbL/CC0 data enters `foods`.** Everything else is live-lookup only.
  This is a hard architectural line (see §5).

## 3. Actionable now — no new data source needed

Ordered by value/effort. Items 1–3 are the ones worth doing this week.

### 3.1 Fix `fuzzy_search_foods` ranking (do first — no schema change)

New migration. Keep `word_similarity` as a **recall filter** (it's doing its
job in the `WHERE`), but replace the saturating `GREATEST` score with a blend
that rewards the signals that actually matter in USDA descriptions:

```sql
-- As shipped in 20260729000100. Helper functions keep the formula readable
-- and let the harness call the exact same code the RPC uses.
public.food_search_score(name, brand, q) =
      0.50 * similarity(split_part(name, ',', 1), q)   -- base food (dominant)
    + 0.20 * GREATEST(similarity(name, q),             -- whole-string Jaccard:
                      similarity(brand, q))            --   penalizes over-specification
    + 0.15 * word_similarity(q, name)                  -- typo + single-word recall
    + 0.10 * similarity(food_name_head(name, 3), q)    -- base + cut (segments 1-3)
    + 0.05 * (1.0 / (1.0 + ln(food_name_segments(name))))  -- brevity nudge

-- WHERE keeps word_similarity as a RECALL filter (a short label vs a 100-char
-- description has near-zero whole-string similarity, so `%` alone returns
-- nothing). ORDER BY breaks ties on source trust, then Foundation over
-- SR Legacy, then safety, then verification.
```

Measured effect on the failing cases: `"beef"` now returns
`Beef, grass-fed, ground, raw` (base_sim 1.0 vs 0.11 for `Beans, baked,
canned, with beef`), and `"rice"` returns `Rice, brown, cooked` above the
noodles and the rice-bran oil. Whole-string Jaccard — not brevity — turned out
to do most of the work demoting the 9-segment Wagyu variants; brevity is only
a 0.05 nudge in the final weights.

**Two things must ship with it:**
- **Raise `MATCH_THRESHOLD`.** The 0.3 floor in `lib/resolve-ingredient.ts` was
  calibrated against the old saturating score. Under the blended score, re-fit
  it against real bowl labels — a blended 0.3 is a much weaker match than a
  saturated 1.0 was.
- **A relevance test suite.** New Jest/integration test with named
  expectations: `search("beef")[0].name` starts with `Beef,`;
  `search("rice")` puts a `Rice, …` row above `Noodles, …` and `Oil, rice
  bran`; `search("chicken breast")` puts a boneless-skinless breast in the top
  3. Without this, ranking regressions are invisible.

**These weights are fitted, not guessed** — see §6 "Measured results" for the
grid search and the 13/18 → 17/18 → 18/18 progression.

### 3.2 Prune the leaked categories

> ⚠️ Read the cascade warning in §3.3 first — deleting `foods` rows cascades
> into `meal_items` and `recipe_ingredients`.

A migration or script that deletes (or flags) the ~58 `salad dressing` rows and
audits `cheese`/`milk`/`oil` for prepared products. Also add the exclusion to
`CATEGORY_WHITELIST` handling in `022_bulk_import_usda_wholefoods.ts` so a
re-run doesn't reintroduce them — either a sub-category denylist or a
description-prefix denylist (`salad dressing`, `shortening`, `margarine`).

Do this **before** normalization, so we don't build canonical keys for rows
we're about to remove.

### 3.3 Merge the 56 exact-name duplicates

> ⚠️ **Blocker — `DELETE FROM foods` destroys user data today.** Both
> `meal_items.food_id` and `recipe_ingredients.food_id` are
> `REFERENCES public.foods(id) ON DELETE CASCADE NOT NULL`
> ([nutrition schema:71](../supabase/migrations/20250620030000_create_nutrition_schema.sql#L71),
> [recipes:24](../supabase/migrations/20250620030300_add_recipes.sql#L24)).
> Deleting a duplicate food row silently deletes every logged meal item and
> recipe ingredient pointing at it — no error, no warning. The same hazard
> applies to §3.2's category pruning.

So the merge script **must repoint before it deletes**, in a transaction:

```sql
UPDATE public.meal_items        SET food_id = :winner WHERE food_id = :loser;
UPDATE public.recipe_ingredients SET food_id = :winner WHERE food_id = :loser;
UPDATE public.source_payloads   SET food_id = :winner WHERE food_id = :loser;
DELETE FROM public.foods WHERE id = :loser;
```

(`source_payloads.food_id` is `ON DELETE SET NULL`, so it degrades rather than
cascades — but repointing keeps the provenance link intact.)

Script shape: service-role, idempotent, **dry-run by default** (the
`scripts/0NN_` house pattern). For each case-insensitive name collision:
- Winner preference: USDA-verified > curated > manual; then `Foundation` >
  `SR Legacy` (needs §3.4); then most non-null nutrient columns.
- Repoint-then-delete as above, one transaction per merge.
- Log every merge decision to a file in `audits/` for review.

Given the cascade hazard, consider a **soft-delete** (`is_active=false`)
instead of a hard `DELETE` for the first pass. It makes the whole operation
reversible and removes the data-loss risk entirely; the search RPC just filters
on it. Leaning soft-delete.

The cross-source shadow duplicates (curated `Beef liver, raw` vs USDA
`Beef, liver, raw`) are **deliberately out of scope here** — they need the
canonical key from §4 to detect. Don't fuzzy-merge them by hand.

### 3.4 Persist `dataType` + `foodCategory` on `foods`

Currently discarded at import. Both are already archived in `source_payloads`,
so this is a **backfill from stored JSON — no re-fetch, no API budget**:

```sql
ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS usda_data_type TEXT,   -- 'Foundation' | 'SR Legacy'
  ADD COLUMN IF NOT EXISTS food_category  TEXT;
-- backfill: UPDATE ... FROM source_payloads WHERE external_id = fdc_id::text
```

This unlocks: category filter chips in the picker, the per-type split the
coverage audit can't currently report, and a Foundation-over-SR-Legacy
preference in dedupe tiebreaks (Foundation has better micronutrient coverage).
It also stops paying the "we threw the field away" tax a third time.

## 4. Normalization & dedupe design

### 4.1 Two-level model

Per the standing decision to keep the physical table named `foods`
(`20260706000000` header comment), **`foods` becomes the variant table** and a
new small table holds the canonical layer. No renames, no data migration.

```sql
CREATE TABLE public.canonical_ingredients (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT NOT NULL UNIQUE,      -- 'beef_ribeye', 'chicken_breast'
  display_name TEXT NOT NULL,             -- 'Beef ribeye'
  base_food    TEXT NOT NULL,             -- 'beef'
  part         TEXT,                      -- 'ribeye'
  category     TEXT,                      -- 'muscle_meat' | 'organ' | 'vegetable' | ...
  is_safe_for_dogs BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS canonical_id UUID
    REFERENCES public.canonical_ingredients(id) ON DELETE SET NULL,
  -- structured attributes parsed out of the USDA description
  ADD COLUMN IF NOT EXISTS variant_attrs JSONB,  -- {cut, trim, grade, origin, bone}
  -- one variant per canonical key is the default the picker shows
  ADD COLUMN IF NOT EXISTS is_canonical_default BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS foods_canonical_id_idx ON public.foods(canonical_id);
```

`preparation_state` already exists and stays on `foods` — it's a real
nutritional difference (raw vs cooked per-100g), so raw and cooked are
**separate variants under one canonical key**, never merged.

A USDA row and a barcode-matched branded product both resolve to the same
`canonical_id` when base food + part match, which is what prevents the
branded layer from re-duplicating the whole-food layer.

### 4.2 The parser

USDA descriptions follow `Base food, [origin/grade], [part/cut], [bone],
[separation], [trim], [grade], [prep]`. Split on commas; token[0] is the base
food (highest confidence); classify the rest against gazetteers:

| Gazetteer | Members (partial) |
|---|---|
| `prep` | raw, uncooked, cooked, roasted, grilled, braised, boiled, broiled, pan-broiled, pan-fried, baked, stewed, steamed, poached, smoked, dried, dehydrated, canned, frozen, microwaved |
| `trim` | separable lean only, separable lean and fat, trimmed to N" fat, lip-off, lip-on, untrimmed, N% lean, meat and skin, meat only, skinless, boneless, bone-in, drained solids |
| `grade` | select, choice, prime, all grades, Aust. marble score N, grass-fed, Wagyu, enhanced, composite |
| `origin` | Australian, imported, New Zealand |

Everything that survives classification is base food + cut → the slug.

**This was prototyped against the live 5,029 rows** with a ~30-line
throwaway parser (gazetteers above, slug = `base + first surviving modifier`):

| Metric | Result |
|---|---|
| 5,029 rows → canonical keys | **1,716** |
| 958 `beef` rows → keys | **67** |
| Keys with exactly one variant | 1,024 |
| Largest buckets | `pork_fresh` 200, `beef_round` 161, `beef_chuck` 118, `chicken_broilers_or_fryers` 116 |

A 3× collapse overall and 14× on beef, from rules alone, before any tuning.
The largest buckets also show exactly what the gazetteers are missing:
`pork_fresh`, `beef_variety_meats_and_by_products`, and
`chicken_broilers_or_fryers` are USDA *category* segments masquerading as
cuts — they belong in a fourth gazetteer (`usda_grouping`) that gets dropped,
which will split those buckets into real cuts.

### 4.3 Resolution pipeline

For each row (USDA import, OFF import, or user-created):

1. **Parse** → `{base_food, cut, prep, trim, grade, origin, brand}`.
2. **Candidate slug** = `slugify(base_food + '_' + cut)`.
3. **Match**: exact slug → merge. Else `pg_trgm` `similarity()` against
   existing `canonical_ingredients.slug` + `display_name`:
   - **≥ 0.90** → auto-merge into that canonical.
   - **0.75–0.90** → review queue (a table + a tiny internal page; not a
     user-facing surface).
   - **< 0.75** → create a new canonical row.
4. **Pick the default variant** per canonical (`is_canonical_default`):
   prefer `Foundation` over `SR Legacy`, `raw` for meats, the shortest
   description, most non-null nutrients. Deterministic, recomputable.
5. **Synonym table**, version-controlled in SQL, applied before step 2:
   `rib eye → ribeye`, `garbanzo → chickpea`, `courgette → zucchini`,
   `ground → mince`. This is where hand corrections live, so the parser
   itself stays clean.

**No LLM/embedding step in v1.** The 0.75–0.90 band is where one would go, and
we should first see how many rows actually land there. If that band is small
(likely, given the controlled vocabulary), a human clears it once and a
synonym-table entry keeps it cleared.

### 4.4 What search becomes

Once `canonical_id` is populated, `fuzzy_search_foods` gains a grouped mode:
rank canonicals, return **one representative row per canonical** plus a
`variant_count`. "beef" returns ~67 grouped results — *Beef ribeye*, *Beef
ground*, *Beef liver* — and expanding one shows its variants. That, not the
scoring blend, is the real fix for the picker UX. §3.1 is the stopgap that
makes search usable in the meantime.

Existing callers (`/api/foods/unified-search`, `/api/ingredients/search`,
`matchLocalIngredient`) keep working on the flat mode; grouped mode is a new
parameter so the return-type change doesn't break the mobile REST clients.

## 5. Adding food resources

The licensing research (2026-07-29) is decisive and worth recording as a
standing decision so it stops being re-litigated:

| Source | License | Can we store it? | Verdict |
|---|---|---|---|
| USDA FDC | CC0 public domain | ✅ Yes | **Backbone.** Already integrated. |
| Open Food Facts / Open Pet Food Facts | ODbL | ✅ Yes (attribution + share-alike on redistribution) | **Branded layer.** Mapper exists, 0 rows imported. |
| FatSecret Premier Free | proprietary | ⚠️ Cache only, not a stored copy | Live lookup only, if at all |
| Edamam | proprietary | ❌ No (4 macros, behind user password) | **Skip** |
| Nutritionix | proprietary | ❌ Enterprise only (~$1,850/mo) | **Skip** |
| API Ninjas | proprietary | ❌ Free tier bars commercial use *and* caching | **Skip** |

**Rule to encode in the architecture: only CC0 and ODbL data may be written to
`foods`.** Everything else is a live, uncached lookup or nothing. This is
already half-true (`foods_source_check` allows `'fatsecret'`) — that enum
member should be reconsidered, since a FatSecret row in `foods` *is* the
prohibited stored copy.

### 5.1 Highest-value actionable item: bulk-import Open Pet Food Facts

`lib/off-integration.ts` works, and `resolve-ingredient.ts` implements
cache-on-accept. But **`source='off'` is 0 rows** — the cache never warms,
because it only fills when an owner accepts a suggestion, and a suggestion only
appears when a bowl label misses locally. Cold-start deadlock.

OPFF publishes a **static bulk export** under ODbL:
`https://static.openpetfoodfacts.org/data/en.openpetfoodfacts.org.products.csv.gz`

Actionable: a `scripts/023_import_opff_bulk.ts` that downloads the export,
filters to rows with a reported `energy-kcal_100g` (the mapper already returns
null without kcal), runs them through `convertOFFToIngredient`, and upserts on
`barcode`. This uses the export instead of the live API, which respects OPFF's
"1 API call = 1 real scan" request — the current design would violate that
etiquette at scale anyway.

Expect **low absolute coverage** — OPFF's pet catalogue is small (hundreds of
products in the category facet) and most lack nutrition. That's an industry
gap, not a fixable one. But it's free, storable, and it turns the branded
fallback from theoretical into real, which is the prerequisite for the barcode
flow being worth building.

### 5.2 Barcode scanning (mobile)

Two corrections to the research doc, verified against npm today:

- **Pin `@capacitor-mlkit/barcode-scanning@7.5.0`, not 8.x.**
  `apps/mobile` is on `@capacitor/core ^7.4.0`; 8.1.0 declares
  `peerDependencies: { "@capacitor/core": ">=8.0.0" }`. 7.5.0 declares
  `>=7.0.0`.
- **License is Apache-2.0** per npm metadata, not MIT. Still permissive, but
  the attribution/NOTICE obligations differ — worth getting right in the
  legal page.

The `foods.barcode` column, its partial unique index, and `fetchOFFByBarcode`
all already exist. So the remaining work is genuinely just the mobile plugin +
a scan affordance in the bowl-confirmation UI. Normalize UPC-A → EAN-13
(zero-pad to 13) before lookup — some plugins return UPC-A already padded and
some don't, so normalizing on our side is the only stable option.

### 5.3 FatSecret Premier Free

Apply now if we want it, because eligibility verification has lead time and
eligibility (<$1M revenue AND <$1M raised) only gets harder to satisfy. But
architect it as **live lookup with display attribution, never a write to
`foods`**. Known blocker to check before building: FatSecret's OAuth uses IP
whitelisting, which does not work with Vercel's serverless egress — their
workaround (whitelist `0.0.0.0/0`) defeats the control. Verify before
committing effort.

### 5.4 USDA — remaining headroom

The bulk import got ~61% of the whitelisted corpus. Worth checking whether the
remainder is (a) categories we deliberately excluded, (b) rows the safety
checker rejected, or (c) batches that failed mid-run (the script counts
`failed` but the run's final tally isn't recorded anywhere). Re-run with
`--dry-run` to get the current delta — it's free, and if it's (c) the fix is
one command.

## 5b. Applied to production — 2026-07-30

All four migrations and all four scripts are **live on `stdqdzvhexqgodpuriaw`**.
Measured outcomes, not projections:

| | Before | After |
|---|---|---|
| `foods` rows | 5,029 | 5,029 (none deleted) |
| …active | — | 4,700 |
| …soft-deleted | — | 329 (274 pruned + 55 merged) |
| Canonical groups | — | **1,432** |
| `"beef"` results | 960 rows | **8 groups** (Beef round ×165, Beef chuck ×152, …) |
| `usda_data_type` populated | 0 | 4,970 (Foundation 311 / SR Legacy 4,659) |
| Relevance harness | 13/18 | **18/18**, exit 0 |

Threshold separation confirmed live: should-resolve floor **0.584**,
should-not-resolve ceiling **0.344**, gap **0.240** — `MATCH_THRESHOLD` 0.5
sits inside it, matching the offline fit almost exactly.

**Three defects surfaced during rollout**, all fixed:

1. **`gin_trgm_ops` not resolvable** — migration `…000200` failed at the
   trigram index. `pg_trgm` lives in `extensions`, which is not on the
   migration runner's `search_path`, even though the identical bare syntax in
   `20250620030200` had succeeded under whatever path applied that migration.
   Fixed by resolving the opclass schema from `pg_opclass` at runtime, so it
   works wherever the extension lives. The failed migration rolled back
   cleanly and was not recorded, so the retry was a no-op replay.
2. **Audit paths resolved against `cwd`** — scripts run from `apps/web` but
   `audits/` is at the repo root, so every report threw `ENOENT` after doing
   all its work. Fixed with `scripts/_audit-path.ts`, which walks up to the
   workspace root.
3. **PostgREST silently truncated the canonical id map at 1,000 rows** — the
   first `--apply` attached only 4,268 of 4,700 variants, leaving 432 rows
   with `canonical_id = NULL` and no error. Fixed by paginating, plus a guard
   that now refuses to attach variants if the map size doesn't match the
   number of canonicals written. This one is worth remembering: an unbounded
   PostgREST `select` is a silent correctness bug at >1,000 rows, and this
   codebase has several.

**One nutrient-quality finding.** Winner selection ranks `source` above
nutrient count, so the USDA row won for `broccoli, raw` and `spinach, raw`
even though the hand-curated losers carried `taurine_mg` and `vitamin_d_mcg`
that USDA leaves NULL — legitimately ~0 for a plant, and useful precisely
because the gap engine treats NULL as *unmeasured*. Rather than accept the
regression, `scripts/025` now backfills any nutrient column that is NULL on
the winner and present on the loser before deactivating it. 12 columns were
salvaged this way. Separately, the `cabbage, red, raw` merge **fixed** a live
bug: the loser was a Foundation row with `calories_per_serving = 0` that a
logged meal already pointed at.

Zero `meal_items` reference a deactivated row — every FK was repointed.

### Known rough edge

Default-variant selection is mediocre for the big primal groups: `Beef round`
defaults to *"Beef, New Zealand, imported, eye round, …"* rather than a plain
domestic cut, because `is_verified` (+1000) dominates the specificity penalty
(−10/attribute) in `pickDefault()`. Cosmetic, not incorrect — every variant is
still reachable — but it wants a rebalance before the picker UI ships. Re-run
`scripts/026 --apply --reset` after any change; it is fully recomputable.

## 6. Phased plan

Phases 0-4 were **implemented on branch `feat/data-normalization` (2026-07-29)**.
Phases 5-6 remain planned.

| Phase | Work | Status |
|---|---|---|
| **0** | §3.1 search ranking fix + relevance harness + re-fit `MATCH_THRESHOLD` | ✅ built |
| **1** | §3.2 prune leakage; §3.3 merge exact dupes; §3.4 backfill `dataType`/`foodCategory` | ✅ built |
| **2** | §4.1 canonical schema; §4.2 parser + gazetteers | ✅ built |
| **3** | §4.3 resolution pipeline + review queue | ✅ built |
| **4** | §4.4 grouped search RPCs + API route | ✅ built (picker UI not rebuilt) |
| **5** | §5.1 OPFF bulk import | planned — do after 3 so it can't re-duplicate |
| **6** | §5.2 barcode scanning in mobile | planned — depends on 5 |

### What shipped

**Migrations** (apply in order; none has been run against prod yet):

| File | Does |
|---|---|
| `20260729000000_add_usda_metadata_and_soft_delete.sql` | `usda_data_type`, `food_category` (backfilled from `source_payloads` — no FDC re-fetch), `is_active`, `inactive_reason` |
| `20260729000100_fuzzy_search_relevance_ranking.sql` | `food_name_head()`, `food_name_segments()`, `food_search_score()`; rewrites `fuzzy_search_foods` |
| `20260729000200_canonical_ingredients.sql` | `canonical_ingredients`, `canonical_review_queue`, `foods.canonical_id` / `variant_attrs` / `is_canonical_default` |
| `20260729000300_search_canonical_ingredients.sql` | `search_canonical_ingredients()`, `list_canonical_variants()` |

**Code**

- `lib/food-name-parser.ts` — gazetteer parser, 16 unit tests
- `lib/food-relevance.ts` — prune rules, shared with the importer
- `lib/resolve-ingredient.ts` — `MATCH_THRESHOLD` 0.3 → 0.5
- `scripts/022_bulk_import_usda_wholefoods.ts` — now applies the description denylist, so a re-run can't reintroduce the leakage
- `scripts/023_search_relevance_check.ts` — relevance + threshold-separation harness
- `scripts/024_prune_prepared_foods.ts` — soft-delete prune (`--apply` / `--revert`)
- `scripts/025_merge_duplicate_foods.ts` — repoint-then-soft-delete merge
- `scripts/026_build_canonical_ingredients.ts` — resolution pipeline (`--apply` / `--reset`)
- `app/api/ingredients/grouped-search/route.ts` + `middleware.ts` registration
- `cypress/e2e/mobile-rest-api.cy.ts` — ranking regression + grouped-search specs

All four scripts **dry-run by default**. Nothing touches the database without
`--apply`.

### Measured results

Ranking, fitted offline against all 5,029 live names with pg_trgm
reimplemented (5,966-point weight grid × 4 formula variants):

| Scoring | Named cases passed |
|---|---|
| Old saturating score | 13/18 |
| Blended score | 17/18 |
| Blended + §3.2 pruning | **18/18** |

Final weights: `base 0.50, full 0.20, word 0.15, head 0.10, brevity 0.05`.
The one case no weighting could fix — `chicken` → "Chicken, meatless" — is a
corpus problem (that string genuinely is the closest match to "chicken"), which
is what made §3.2 a prerequisite rather than a nice-to-have.

`MATCH_THRESHOLD` separation, measured across the whole corpus:

| Group | Score range |
|---|---|
| Labels that should resolve locally | 0.584 – 0.913 |
| Branded/DTC labels that should not | 0.000 – 0.363 |

0.5 sits mid-gap.

Pruning: **274 rows (5.4%)** across 9 rules. Hand-reviewed for false positives;
the one found (`Squash, pie pumpkin, peeled, seeded, raw` — a legitimate raw
squash) is excluded by a negative lookahead.

Canonical collapse, run over the post-prune corpus:

| Metric | Value |
|---|---|
| Active rows after prune | 4,755 |
| Canonical keys | **1,441** |
| beef | 960 rows → **43 keys** |
| pork | 331 → 36 |
| lamb | 297 → 31 |
| chicken | 212 → 23 |
| turkey | 113 → 20 |
| Rows with unparsed residual segments | 1,992 |

Cross-source merging verified: `Beef liver, raw` (curated) and `Beef, liver,
raw` (USDA) both key to `beef_liver`; all three chicken-breast naming
conventions — including `Chicken, broilers or fryers, breast, meat only,
cooked, roasted` — key to `chicken_breast`.

### Not built, deliberately

- **The picker UI.** The grouped-search RPCs and API route exist and are
  covered by specs, but no ingredient-picker component was rewritten to
  consume them. That is a UI project with its own design decisions (how to
  render variant expansion, what badges to show) and is better scoped
  separately. Flat search still backs every existing surface.
- **The review-queue admin page.** `canonical_review_queue` is populated by
  scripts/026 and readable via service role; there is no internal UI for it.
  The audit report in `audits/canonical-ingredients.md` is the current
  interface.

Per the house convention, stop at each phase boundary for a manual smoke test.

## 7. Open questions

1. ~~Delete or flag the salad dressings?~~ **Answered: flag.** `is_active` +
   `inactive_reason` — reversible (`scripts/024 --revert`), and it cannot
   destroy user data (see #2).
2. ~~Does anything reference the 56 duplicate rows?~~ **Answered:
   `meal_items` and `recipe_ingredients` both cascade-delete off `foods`.**
   Every removal path in this work is therefore a soft delete, and
   scripts/025 repoints all references before deactivating a loser.
3. ~~Ranking weights are untuned guesses.~~ **Answered:** fitted, measured, and
   recorded in §6 and in the migration header.
4. **`'fatsecret'` in `foods_source_check`** — still open. Given §5's rule that
   only CC0/ODbL data may be written to `foods`, that enum member documents an
   architecture we have decided against. Removing it is a one-line migration
   but changes a CHECK constraint, so it wants a deliberate call.
5. **Share-alike, again.** Bulk-importing OPFF (§5.1) creates a substantially
   larger derivative database than cache-on-accept did. Still fine for powering
   our own app; still bites only on public redistribution. Decision #3 in
   `BRANDED_INGREDIENTS_DESIGN.md` §11 covers it, but the scale change is worth
   a second look.
6. **1,992 rows still carry unparsed residual segments.** They are recorded in
   `variant_attrs.residual`, not lost, and most are retail sub-cut detail we
   deliberately do not key on (`shoulder clod`, `porterhouse steak`, `small
   end`). The `audits/canonical-ingredients.md` report ranks them by frequency;
   adding the frequent ones to the gazetteers is the cheapest available quality
   win. No action needed unless grouping quality proves insufficient in use.
7. **Is primal-level the right granularity?** `beef_round` groups 165 variants.
   That is a good default for a dog-food picker, but if owners routinely need
   to distinguish sub-cuts the model supports going finer without a schema
   change — it is a parser decision, not a structural one.
