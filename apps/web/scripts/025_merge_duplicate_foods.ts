/**
 * Merge exact-name duplicate rows in `foods`
 * (docs/DATA_NORMALIZATION_DESIGN.md §3.3).
 *
 * The bulk import created 52 case-insensitive name collisions across 56
 * redundant rows — Foundation and SR Legacy describing the same food, plus
 * hand-curated rows that now shadow their USDA equivalents. `fdc_id` is
 * UNIQUE so the importer's upsert could not catch these.
 *
 * DATA-LOSS HAZARD (why this script is careful)
 * `meal_items.food_id` and `recipe_ingredients.food_id` are both
 * `REFERENCES public.foods(id) ON DELETE CASCADE NOT NULL`. Deleting a loser
 * row would cascade-delete every logged meal item and recipe ingredient
 * pointing at it. So losers are REPOINTED to the winner first, and then only
 * soft-deleted — never hard-deleted. Nothing in this script can destroy a
 * user's logged data.
 *
 * WINNER SELECTION (first rule that discriminates wins):
 *   1. is_verified            — a verified profile beats an unverified one
 *   2. source                 — usda > curated > manual > off
 *   3. usda_data_type         — Foundation > SR Legacy (better micro coverage)
 *   4. non-null nutrient count — more measured nutrients is strictly better
 *   5. fdc_id present         — traceable to a source of record
 *   6. oldest created_at      — stable, so re-runs pick the same winner
 *
 * Only EXACT (case/whitespace-insensitive) name matches are merged here.
 * Cross-source near-duplicates ("Beef liver, raw" vs "Beef, liver, raw") are
 * deliberately out of scope — they need the canonical key from
 * scripts/026_build_canonical_ingredients.ts, which groups them without
 * having to assert they are the same food.
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/025_merge_duplicate_foods.ts            # dry run (default)
 *   npx tsx scripts/025_merge_duplicate_foods.ts --apply
 */

import { createClient } from '@supabase/supabase-js'
import { auditPath } from './_audit-path'
import { writeFileSync } from 'node:fs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing env. Run: set -a && source .env.local && set +a  first.')
  process.exit(1)
}

const APPLY = process.argv.includes('--apply')
const AUDIT_PATH = auditPath('merge-duplicate-foods.md')

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** Nutrient columns counted for the "more measured data" tiebreak. */
const NUTRIENT_COLUMNS = [
  'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg',
  'cholesterol_mg', 'vitamin_a_mcg', 'vitamin_c_mg', 'vitamin_d_mcg',
  'vitamin_e_mg', 'vitamin_b12_mcg', 'calcium_mg', 'iron_mg', 'magnesium_mg',
  'potassium_mg', 'zinc_mg', 'selenium_mcg', 'folate_mcg', 'taurine_mg',
  'phosphorus_mg', 'omega3_epa_dha_mg', 'omega6_la_mg', 'vitamin_d_iu',
  'choline_mg', 'copper_mg', 'manganese_mg', 'iodine_mcg',
  'methionine_cystine_mg', 'lysine_mg', 'tryptophan_mg', 'threonine_mg',
  'isoleucine_mg', 'leucine_mg', 'valine_mg', 'arginine_mg', 'histidine_mg',
  'phenylalanine_tyrosine_mg', 'thiamin_mg', 'riboflavin_mg', 'niacin_mg',
  'pantothenic_acid_mg', 'vitamin_b6_mg',
] as const

const SOURCE_RANK: Record<string, number> = {
  usda: 4,
  curated: 3,
  manual: 2,
  off: 1,
  fatsecret: 0,
}

interface FoodRow {
  id: string
  name: string
  fdc_id: number | null
  source: string | null
  usda_data_type: string | null
  is_verified: boolean | null
  created_at: string
  [key: string]: unknown
}

function nutrientCount(row: FoodRow): number {
  return NUTRIENT_COLUMNS.filter(c => row[c] !== null && row[c] !== undefined).length
}

/** Normalized merge key: case- and whitespace-insensitive full name. */
function mergeKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Sorts best-first. The comparator IS the winner-selection policy. */
function byPreference(a: FoodRow, b: FoodRow): number {
  const verified = Number(b.is_verified ?? false) - Number(a.is_verified ?? false)
  if (verified !== 0) return verified

  const source = (SOURCE_RANK[b.source ?? ''] ?? -1) - (SOURCE_RANK[a.source ?? ''] ?? -1)
  if (source !== 0) return source

  const foundation =
    Number(b.usda_data_type === 'Foundation') - Number(a.usda_data_type === 'Foundation')
  if (foundation !== 0) return foundation

  const nutrients = nutrientCount(b) - nutrientCount(a)
  if (nutrients !== 0) return nutrients

  const hasFdc = Number(b.fdc_id !== null) - Number(a.fdc_id !== null)
  if (hasFdc !== 0) return hasFdc

  // Stable final tiebreak so repeat runs choose the same winner.
  return a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
}

async function countReferences(foodId: string): Promise<{ meals: number; recipes: number }> {
  const [meals, recipes] = await Promise.all([
    supabase.from('meal_items').select('id', { count: 'exact', head: true }).eq('food_id', foodId),
    supabase
      .from('recipe_ingredients')
      .select('id', { count: 'exact', head: true })
      .eq('food_id', foodId),
  ])
  if (meals.error) throw meals.error
  if (recipes.error) throw recipes.error
  return { meals: meals.count ?? 0, recipes: recipes.count ?? 0 }
}

async function main() {
  const rows: FoodRow[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from('foods')
      .select(
        ['id', 'name', 'fdc_id', 'source', 'usda_data_type', 'is_verified', 'created_at']
          .concat(NUTRIENT_COLUMNS as unknown as string[])
          .join(',')
      )
      .eq('is_active', true)
      .order('name')
      .range(offset, offset + 999)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...(data as unknown as FoodRow[]))
    if (data.length < 1000) break
  }
  console.error(`Scanned ${rows.length} active rows.`)

  const groups = new Map<string, FoodRow[]>()
  for (const row of rows) {
    const key = mergeKey(row.name)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(row)
  }
  const collisions = [...groups.entries()].filter(([, list]) => list.length > 1)
  const redundant = collisions.reduce((n, [, list]) => n + list.length - 1, 0)

  console.error(
    `Found ${collisions.length} name collision(s) covering ${redundant} redundant row(s).\n`
  )

  const lines: string[] = [
    '# Merge audit — exact-name duplicates in `foods`',
    '',
    `_Generated ${new Date().toISOString().slice(0, 10)} by ` +
      `scripts/025_merge_duplicate_foods.ts (${APPLY ? 'APPLIED' : 'DRY RUN'})._`,
    '',
    `${collisions.length} collisions, ${redundant} redundant rows.`,
    '',
    'Losers are repointed then soft-deleted (`is_active = false`,',
    "`inactive_reason = 'duplicate_of:<winner-id>'`) — never hard-deleted,",
    'because `meal_items`/`recipe_ingredients` cascade off `foods`.',
    '',
  ]

  let merged = 0
  let repointedMeals = 0
  let repointedRecipes = 0
  let backfilledColumns = 0

  for (const [key, list] of collisions) {
    const sorted = [...list].sort(byPreference)
    const [winner, ...losers] = sorted

    lines.push(`## ${key}`, '')
    lines.push(
      `- **winner** \`${winner.id}\` — source=${winner.source} ` +
        `type=${winner.usda_data_type ?? '-'} fdc=${winner.fdc_id ?? '-'} ` +
        `verified=${winner.is_verified} nutrients=${nutrientCount(winner)}`
    )

    for (const loser of losers) {
      const refs = await countReferences(loser.id)
      repointedMeals += refs.meals
      repointedRecipes += refs.recipes
      lines.push(
        `- loser \`${loser.id}\` — source=${loser.source} ` +
          `type=${loser.usda_data_type ?? '-'} fdc=${loser.fdc_id ?? '-'} ` +
          `verified=${loser.is_verified} nutrients=${nutrientCount(loser)} ` +
          `refs=${refs.meals} meal_items / ${refs.recipes} recipe_ingredients`
      )

      if (APPLY) {
        // Salvage nutrient coverage before the loser is hidden. Winner
        // selection ranks `source` above nutrient count, so a hand-curated
        // loser can carry columns the USDA winner leaves NULL — observed on
        // broccoli and spinach, where the curated rows record taurine_mg and
        // vitamin_d_mcg (legitimately ~0 for a plant) that USDA never
        // reports. Without this, merging would turn a known zero back into
        // "unknown" and quietly widen the gap engine's unmeasured set.
        // Only fills NULLs — a value the winner already has always stands.
        const backfill: Record<string, unknown> = {}
        for (const column of NUTRIENT_COLUMNS) {
          if (
            (winner[column] === null || winner[column] === undefined) &&
            loser[column] !== null &&
            loser[column] !== undefined
          ) {
            backfill[column] = loser[column]
          }
        }
        if (Object.keys(backfill).length > 0) {
          const { error } = await supabase
            .from('foods')
            .update(backfill)
            .eq('id', winner.id)
          if (error) throw error
          lines.push(
            `  - backfilled onto winner from loser: ` +
              `${Object.keys(backfill).join(', ')}`
          )
          backfilledColumns += Object.keys(backfill).length
        }

        // Order matters: repoint EVERY reference before deactivating, so no
        // window exists where a meal_item points at a hidden row.
        if (refs.meals > 0) {
          const { error } = await supabase
            .from('meal_items')
            .update({ food_id: winner.id })
            .eq('food_id', loser.id)
          if (error) throw error
        }
        if (refs.recipes > 0) {
          const { error } = await supabase
            .from('recipe_ingredients')
            .update({ food_id: winner.id })
            .eq('food_id', loser.id)
          if (error) throw error
        }
        // source_payloads is ON DELETE SET NULL, so it degrades rather than
        // cascades — repoint anyway to keep provenance attached to the winner.
        const { error: payloadError } = await supabase
          .from('source_payloads')
          .update({ food_id: winner.id })
          .eq('food_id', loser.id)
        if (payloadError) throw payloadError

        const { error: deactivateError } = await supabase
          .from('foods')
          .update({ is_active: false, inactive_reason: `duplicate_of:${winner.id}` })
          .eq('id', loser.id)
        if (deactivateError) throw deactivateError
        merged++
      }
    }
    lines.push('')
  }

  writeFileSync(AUDIT_PATH, lines.join('\n'))
  console.error(`Report written to ${AUDIT_PATH}`)
  console.error(
    `References found on loser rows: ${repointedMeals} meal_items, ` +
      `${repointedRecipes} recipe_ingredients`
  )

  if (!APPLY) {
    console.error(
      `\nDry run — nothing written. Re-run with --apply to merge ` +
        `${redundant} row(s).`
    )
    return
  }
  console.error(
    `\nDone. Merged (repointed + deactivated) ${merged} row(s); ` +
      `backfilled ${backfilledColumns} nutrient column(s) onto winners.`
  )
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
