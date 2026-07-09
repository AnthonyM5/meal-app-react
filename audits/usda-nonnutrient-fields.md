# USDA Non-Nutrient Field Keep/Discard Decisions

_Audit-plan AC #4 (`NUTRIENT_API_SOURCING_AND_AUDIT.md` §3.3). Generated 2026-07-08._

Every top-level field a `format=full` FDC response carries **besides** `foodNutrients`,
with an explicit keep-or-discard decision. Observed across the same 20-food sample used
for AC #1 (all 20 foods carried every field below except `scientificName`, present in 9).

Today the importer (`convertUSDAToIngredient` in `lib/usda-canine.ts`) reads only
`fdcId`, `description`, `brandOwner`/`brandName`, and `foodNutrients`. Everything else is
dropped. This table records whether that's the right call per field.

| Field | Example | Decision | Rationale |
|---|---|---|---|
| `fdcId` | `171060` | **KEEP** (already) | Stored as `foods.fdc_id`; dedupe key + backfill key. |
| `description` | `"Chicken, liver, all classes, raw"` | **KEEP** (already) | Stored as `foods.name`; also drives `inferPreparationState()` and `checkDogSafety()`. |
| `dataType` | `"SR Legacy"` | **KEEP — not yet stored** | Cheap provenance signal (Foundation vs SR Legacy vs Branded). Needed to compute the AC #3 corpus split, which we currently *can't* because it isn't persisted. Recommend adding a `source_data_type` column. |
| `foodPortions` | `[{gramWeight:44, modifier:"liver"}, {gramWeight:113, amount:4, modifier:"oz"}]` | **KEEP — candidate** | Owner-friendly household units ("1 liver ≈ 44 g", "4 oz ≈ 113 g"). Would improve the meal-builder UX (log by piece/oz instead of grams). Deferred — needs a `food_portions` child table or JSONB column. Flagged as the highest-value non-nutrient field. |
| `foodCategory` | `{description:"Poultry Products"}` | **KEEP — candidate** | Useful for grouping/filtering ingredients in browse UI and for RAG retrieval (Phase 5). Low effort — a single `food_category` text column. |
| `publicationDate` | `"4/1/2019"` | **KEEP — not yet stored** | Data-freshness / audit trail; supports the §3.5 quarterly drift check. Add a `usda_publication_date` column when raw-response persistence (§3.4) lands. |
| `nutrientConversionFactors` | `{proteinValue:4.27, fatValue:9.02, carbohydrateValue:3.87}` | **DISCARD** | Atwater factors USDA already used to compute the kcal we import. We take the derived Energy value (1008) directly, so we don't need the factors. Keep only if we ever recompute kcal ourselves. |
| `foodAttributes` | NCBI Taxon, `"Gallus gallus"`, FoodOn ontology IDs | **DISCARD** | Taxonomy/ontology cross-references. No use in nutrient math, safety, or UI. `scientificName` (below) is the only useful sub-part and is surfaced separately. |
| `scientificName` | `"Gallus gallus"` | **DISCARD** (optional keep) | Nice-to-have trivia for a detail page; no functional use. Skip. |
| `inputFoods` | `[]` (empty for SR Legacy whole foods) | **DISCARD** | Only populated for composite/branded/survey foods (recipe breakdowns). Irrelevant to whole-food fresh feeding; empty for our corpus. |
| `foodComponents` | `[]` | **DISCARD** | Refuse/bone/fat component breakdown; empty for the foods we import. |
| `ndbNumber` | `5027` | **DISCARD** | Legacy SR identifier, superseded by `fdcId`. |
| `isHistoricalReference` | `true` | **DISCARD** (optional) | Flags SR Legacy historical entries. Could inform a "prefer Foundation over SR Legacy" ranking later, but not needed now. |
| `foodClass` | `"FinalFood"` | **DISCARD** | Internal FDC classification; no downstream use. |

## Summary of recommended additions (none blocking)

Ordered by value; all deferred, none required for correctness today:

1. **`foodPortions`** → household-unit logging (best UX payoff).
2. **`dataType`** → provenance + makes the AC #3 per-type corpus split computable.
3. **`foodCategory`** → browse grouping + RAG retrieval (Phase 5), trivial to add.
4. **`publicationDate`** → freshness/audit, pairs naturally with §3.4 raw-response persistence.

The cleanest way to capture all four at once is the §3.4 structural fix: persist the raw
`format=full` JSON in a `raw_response JSONB` column, then derive these (and any future
field) from stored data without re-fetching. Until then, they can be added as discrete
columns if a specific feature needs one.
