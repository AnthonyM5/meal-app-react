/**
 * Soft-delete the food rows that carry no usable nutrition, so search and the
 * bowl resolver stop reaching them.
 *
 * WHAT IS LEFT AFTER scripts/029
 * 029 repaired 226 of 245 zero-kcal rows from the payloads captured at import.
 * Two groups survived it, and both silently understate a meal:
 *
 *   A. 18 rows with no energy AND no macros — every cooking oil, both dry
 *      spaghettis, raisins, dried cranberries, grapefruit, rhubarb,
 *      pomegranate juice, ranch dressing, three canned bean products.
 *      029 left them at 0 rather than guessing, and `isNutritionallyUsable`
 *      passed them because all-zero is legitimate for a supplement.
 *
 *   B. 12 rows whose payload carried protein but NEITHER fat NOR carbohydrate.
 *      029's 4/4/9 fallback derived energy from the protein alone, putting
 *      leeks at 5.87 kcal against a real 61 and prune juice at 1.69 against
 *      71. These are WORSE than before 029: at 0 kcal with protein > 0 the
 *      predicate refused them as physically impossible; above 0 it accepted
 *      them. The backfill converted 12 correctly-refused rows into accepted
 *      ones understating by 90-97%.
 *
 * WHY NOT RE-FETCH
 * `audits/zero-calorie-backfill.md` says these need a fresh FDC fetch. They do
 * not — FDC has no energy and no proximates for them either. fdc 748608
 * ("Oil, olive, extra virgin") publishes 33 nutrients, the whole fatty acid
 * profile and the tocopherols, and no total fat. fdc 2758998 (dry spaghetti)
 * publishes 19 and no energy. These are partial Foundation entries; the
 * payload captured at import was faithful and there is nothing to recover.
 *
 * WHY DEACTIVATE RATHER THAN CURATE
 * 28 of the 30 already have a complete SR Legacy sibling in the same table —
 * "Oil, olive, salad or cooking" (884 kcal) sits beside the broken extra
 * virgin row and currently LOSES to it on similarity, so searching "olive
 * oil" resolves to 0 kcal today. Deactivating the shell hands the query to
 * the sibling without inventing a number or claiming one FDC record's data
 * for another's id.
 *
 * The two with no sibling (`Pawpaw, peeled, seeded, raw` and
 * `Dressing, Ranch`) simply stop resolving. That is the intended outcome:
 * no match is better than a match that reads 4.61 kcal for a pawpaw.
 *
 * NON-DESTRUCTIVE: sets is_active = false and inactive_reason. Never DELETEs a
 * food — `foods` cascades to meal_items and recipe_ingredients, so a hard
 * delete would take an owner's logged history with it. Verified before
 * writing this: 0 meal_items and 0 recipe_ingredients reference any of the 30.
 *
 * Reversible, but NOT by blind reactivation — these rows are still exactly
 * as unusable as when they were deactivated (see WHY NOT RE-FETCH above), so
 * running the naive form puts the same broken 0-kcal rows back in front of
 * search_canonical_ingredients / fuzzy_search_foods, undoing this script's
 * whole point:
 *   UPDATE foods SET is_active = true, inactive_reason = NULL
 *    WHERE inactive_reason LIKE 'unusable:%';
 * Only run that for a row whose energy has actually been repaired first
 * (scripts/029, a fresh FDC fetch, or manual curation) — or re-check it
 * against isNutritionallyUsable() before flipping is_active back on.
 * (The 3 canonical groups deleted below are rebuilt by scripts/026.)
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/030_deactivate_unusable_food_shells.ts          # dry run
 *   npx tsx scripts/030_deactivate_unusable_food_shells.ts --apply
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'
import { auditPath } from './_audit-path'
import { fetchAllActiveFoods } from './_fetch-all'
import {
  isNutritionallyUsable,
  NON_CALORIC,
  resolveEnergyKcal,
  UNUSABLE_REASON,
  USDA_CANINE_NUTRIENT_IDS,
  type USDANutrientEntry,
} from '../lib/usda-canine'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing env. Run: set -a && source .env.local && set +a  first.')
  process.exit(1)
}

const APPLY = process.argv.includes('--apply')
const CHUNK = 200

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface FoodRow {
  id: string
  fdc_id: number | null
  name: string
  calories_per_serving: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
  data_completeness: string | null
  canonical_id: string | null
  is_canonical_default: boolean | null
}

/** Which of the two shapes this row is, for the audit. */
function shape(r: FoodRow): 'truncated-payload' | 'empty-shell' {
  return Number(r.protein_g ?? 0) > 0 ? 'truncated-payload' : 'empty-shell'
}

/**
 * Mirrors buildAmountMap in lib/usda-canine.ts, which is module-private;
 * duplicating six lines is better than widening that module's API for one
 * script. Same approach scripts/029 takes.
 */
function amountMap(entries: USDANutrientEntry[]): Map<number, number> {
  const map = new Map<number, number>()
  for (const entry of entries) {
    const id = entry.nutrientId ?? entry.nutrient?.id
    const amount = entry.value ?? entry.amount
    if (id != null && amount != null && !map.has(id)) map.set(id, amount)
  }
  return map
}

/**
 * ORDERING HAZARD. scripts/029 repairs a 0-kcal row from its stored FDC
 * payload (source_payloads), but only among rows where `is_active = true`.
 * If this script runs first, a row 029 could still have repaired gets
 * deactivated here and 029's `.eq('is_active', true)` filter can never find
 * it again — the repair opportunity is gone for good, not just deferred.
 *
 * This replicates 029's own repairability check (stored payload resolves to
 * energy > 0) against the empty-shell rows this script is about to
 * deactivate, and aborts if any still qualify.
 */
async function findStillRepairable(
  rows: FoodRow[]
): Promise<Array<{ name: string; fdc_id: number }>> {
  const ids = USDA_CANINE_NUTRIENT_IDS
  const candidates = rows.filter(
    (r): r is FoodRow & { fdc_id: number } =>
      Number(r.calories_per_serving ?? 0) === 0 && r.fdc_id != null
  )
  if (candidates.length === 0) return []

  const payloads = new Map<string, USDANutrientEntry[]>()
  for (let i = 0; i < candidates.length; i += CHUNK) {
    const slice = candidates.slice(i, i + CHUNK).map(r => String(r.fdc_id))
    const { data, error } = await supabase
      .from('source_payloads')
      .select('external_id,payload')
      .eq('source', 'usda')
      .in('external_id', slice)
    if (error) throw error
    for (const p of data ?? []) {
      const nutrients = (p.payload as { foodNutrients?: USDANutrientEntry[] })
        ?.foodNutrients
      if (Array.isArray(nutrients)) payloads.set(String(p.external_id), nutrients)
    }
  }

  return candidates
    .filter(r => {
      const entries = payloads.get(String(r.fdc_id))
      if (!entries) return false
      const amounts = amountMap(entries)
      const macros = {
        protein: amounts.get(ids.PROTEIN) ?? Number(r.protein_g ?? 0),
        carbs: amounts.get(ids.CARBS) ?? Number(r.carbs_g ?? 0),
        fat: amounts.get(ids.FAT) ?? Number(r.fat_g ?? 0),
      }
      return resolveEnergyKcal(amounts, macros) > 0
    })
    .map(r => ({ name: r.name, fdc_id: r.fdc_id }))
}

async function main() {
  const rows = await fetchAllActiveFoods<FoodRow>(
    supabase,
    'id,fdc_id,name,calories_per_serving,protein_g,fat_g,carbs_g,' +
      'data_completeness,canonical_id,is_canonical_default'
  )
  console.error(`Scanning ${rows.length} active rows...`)

  // The predicate is the single definition of "unusable" — this script must
  // never drift from what the resolver actually refuses. A row marked
  // NON_CALORIC passes it and is therefore never touched here.
  const unusable = rows.filter(r => !isNutritionallyUsable(r))

  if (unusable.some(r => r.data_completeness === NON_CALORIC)) {
    throw new Error(
      'A row marked non_caloric was judged unusable — the predicate and this ' +
        'script disagree. Aborting rather than deactivating a supplement.'
    )
  }

  // ORDERING HAZARD (029 before 030): see findStillRepairable's docstring.
  const stillRepairable = await findStillRepairable(unusable)
  if (stillRepairable.length > 0) {
    throw new Error(
      `${stillRepairable.length} row(s) about to be deactivated still have a ` +
        `repairable energy figure in their stored FDC payload — ` +
        `${stillRepairable.map(r => r.name).join(', ')}. Run ` +
        'scripts/029_backfill_zero_calorie_foods.ts --apply first: once this ' +
        'script deactivates them they drop out of that script\'s ' +
        '`is_active = true` filter and can never be repaired.'
    )
  }

  // ORDERING HAZARD. Migration 20260818000000 is what marks the genuinely
  // non-caloric rows. Run before it, this script sees eggshell powder as an
  // unmarked all-zero row and deactivates a legitimate supplement — exactly
  // the outcome the migration exists to prevent. Nothing else in the schema
  // distinguishes "migration not applied" from "no supplements in this DB",
  // so require the marked row to exist rather than guess.
  const marked = rows.filter(r => r.data_completeness === NON_CALORIC).length
  if (marked === 0) {
    throw new Error(
      'No row carries data_completeness = non_caloric. Migration ' +
        '20260818000000_flag_non_caloric_foods.sql has almost certainly not ' +
        'been applied — run `supabase db push` first. Proceeding would ' +
        'deactivate every genuinely non-caloric supplement.'
    )
  }
  console.error(`${marked} row(s) marked ${NON_CALORIC} — migration is applied.`)

  // Groups that lose every active member. Left in place they would rank with
  // zero variants; scripts/026 rebuilds canonical_ingredients from active
  // rows, so deleting them here matches what a rebuild would produce.
  const survivorsByGroup = new Map<string, number>()
  for (const r of rows) {
    if (!r.canonical_id) continue
    const alive = isNutritionallyUsable(r) ? 1 : 0
    survivorsByGroup.set(
      r.canonical_id,
      (survivorsByGroup.get(r.canonical_id) ?? 0) + alive
    )
  }
  const emptied = [
    ...new Set(unusable.map(r => r.canonical_id).filter((c): c is string => !!c)),
  ].filter(c => (survivorsByGroup.get(c) ?? 0) === 0)

  // A surviving group whose DEFAULT is being deactivated would collapse to a
  // variant picker with no elected row. None exist today; fail loudly rather
  // than silently leaving one if that changes.
  const orphanedDefaults = unusable.filter(
    r => r.is_canonical_default && r.canonical_id && !emptied.includes(r.canonical_id)
  )
  if (orphanedDefaults.length > 0) {
    throw new Error(
      `${orphanedDefaults.length} surviving group(s) would lose their default ` +
        `variant: ${orphanedDefaults.map(r => r.name).join(', ')}. Re-run ` +
        `scripts/026 to re-elect defaults, then re-run this script.`
    )
  }

  console.error(
    `\n${unusable.length} unusable row(s); ${emptied.length} canonical group(s) emptied\n`
  )
  for (const r of unusable) {
    console.error(
      `  [${shape(r)}] ${r.name} — ${r.calories_per_serving ?? 0} kcal, fdc ${r.fdc_id ?? '—'}`
    )
  }

  if (!APPLY) {
    console.error('\nDRY RUN. Re-run with --apply to write.')
    writeAudit(unusable, emptied, false)
    return
  }

  let updated = 0
  for (let i = 0; i < unusable.length; i += CHUNK) {
    const batch = unusable.slice(i, i + CHUNK)
    const { error } = await supabase
      .from('foods')
      .update({
        is_active: false,
        inactive_reason: UNUSABLE_REASON,
      })
      .in('id', batch.map(r => r.id))
    if (error) throw error
    updated += batch.length
  }

  // ON DELETE SET NULL on foods.canonical_id nulls the (now inactive) members.
  let groupsDeleted = 0
  if (emptied.length > 0) {
    const { error } = await supabase
      .from('canonical_ingredients')
      .delete()
      .in('id', emptied)
    if (error) throw error
    groupsDeleted = emptied.length
  }

  console.error(
    `\nAPPLIED: ${updated} row(s) deactivated, ${groupsDeleted} empty group(s) removed.`
  )
  writeAudit(unusable, emptied, true)
}

function writeAudit(rows: FoodRow[], emptied: string[], applied: boolean) {
  const bySh = (s: string) => rows.filter(r => shape(r) === s)
  const table = (rs: FoodRow[]) =>
    rs
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(
        r =>
          `| ${r.name} | ${r.calories_per_serving ?? 0} | ${r.protein_g ?? 0} | ` +
          `${r.fat_g ?? 0} | ${r.carbs_g ?? 0} | ${r.fdc_id ?? '—'} |`
      )
      .join('\n')

  const md = `# Unusable food shells — deactivation

Generated ${new Date().toISOString()} by \`scripts/030_deactivate_unusable_food_shells.ts\` (${applied ? 'APPLIED' : 'DRY RUN'}).

${rows.length} active rows carry no usable energy figure. They are soft-deleted
(\`is_active = false\`, \`inactive_reason = '${UNUSABLE_REASON}'\`), never
hard-deleted — \`foods\` cascades to \`meal_items\` and \`recipe_ingredients\`.

Re-fetching does not recover these: FDC publishes no energy and no proximates
for them either. See the script header.

## Empty shells — no energy, no macros (${bySh('empty-shell').length})

Passed the old predicate because all-zero is legitimate for a supplement.
Eggshell powder, the one row where that is true, is marked
\`data_completeness = 'non_caloric'\` and is NOT in this list.

| food | kcal | protein | fat | carbs | fdc_id |
|---|---:|---:|---:|---:|---|
${table(bySh('empty-shell'))}

## Truncated payloads — protein only (${bySh('truncated-payload').length})

Payload carried protein but neither fat nor carbohydrate, so scripts/029
derived energy from the protein alone. These read 1-6 kcal against real values
of 16-72, and were ACCEPTED by the old predicate because the derived figure is
above zero.

| food | kcal | protein | fat | carbs | fdc_id |
|---|---:|---:|---:|---:|---|
${table(bySh('truncated-payload'))}

## Canonical groups removed (${emptied.length})

Every member was unusable, so the group would have ranked with zero variants.
\`scripts/026\` rebuilds \`canonical_ingredients\` from active rows and will not
recreate these.

${emptied.map(e => `- \`${e}\``).join('\n') || '_none_'}
`
  const path = auditPath('unusable-food-shells.md')
  writeFileSync(path, md)
  console.error(`Audit written to ${path}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
