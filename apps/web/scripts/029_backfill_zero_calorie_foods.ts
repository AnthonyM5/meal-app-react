/**
 * Repair the Foundation rows that report 0 kcal.
 *
 * WHAT WENT WRONG
 * `extractCanineNutrients` read energy from FDC nutrient 1008 only. SR Legacy
 * foods carry 1008; Foundation foods DO NOT — they report energy solely under
 * the Atwater nutrients 2047 (general factors) and 2048 (specific factors).
 * The `?? 0` fallback therefore wrote 0 kcal for every Foundation import:
 *
 *   245 of 4,700 active rows at 0 kcal
 *   176 of those carrying >1 g protein — physically impossible
 *    47 of those elected as the DEFAULT variant of a canonical group,
 *       including `butter`, `yogurt` and `spinach`
 *
 * A bowl item matching one of those logged as zero calories, and the owner
 * saw a plausible-looking kcal range because `range()` in resolve-ingredient
 * filters `n > 0` — the zero row was excluded from the range it was the
 * selected member of.
 *
 * lib/usda-canine.ts is fixed so no FUTURE import repeats this. This script
 * repairs the rows already in the table, using the payloads captured at import
 * time (`source_payloads`) rather than re-fetching FDC — same bytes the
 * importer saw, so the repair is reproducible and needs no API key.
 *
 * NON-DESTRUCTIVE: writes `calories_per_serving` and nothing else. Never
 * deletes or deactivates a row — `foods` cascades to meal_items and
 * recipe_ingredients, so a hard delete would take an owner's logged history
 * with it.
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/029_backfill_zero_calorie_foods.ts          # dry run
 *   npx tsx scripts/029_backfill_zero_calorie_foods.ts --apply
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'
import { auditPath } from './_audit-path'
import {
  USDA_CANINE_NUTRIENT_IDS,
  resolveEnergyKcal,
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

interface BrokenRow {
  id: string
  fdc_id: number | null
  name: string
  usda_data_type: string | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
  is_canonical_default: boolean | null
}

type Outcome = 'repaired' | 'derived' | 'empty_shell' | 'no_payload'

interface Result {
  row: BrokenRow
  outcome: Outcome
  kcal: number
  /** Which FDC nutrient supplied the answer, for the audit trail. */
  via: string
}

/**
 * Rebuild the id -> amount map the extractor would have built. Mirrors
 * buildAmountMap in lib/usda-canine.ts, which is module-private; duplicating
 * six lines is better than widening that module's API for one script.
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

async function main() {
  const ids = USDA_CANINE_NUTRIENT_IDS

  // Every row whose energy is missing. The `> 0` macro test is what separates
  // "broken" from "legitimately zero" (eggshell powder is a calcium
  // supplement and correctly reports 0 across the board).
  const { data: brokenData, error } = await supabase
    .from('foods')
    .select('id,fdc_id,name,usda_data_type,protein_g,fat_g,carbs_g,is_canonical_default')
    .eq('is_active', true)
    .eq('calories_per_serving', 0)
  if (error) throw new Error(`fetch broken rows: ${error.message}`)
  const broken = (brokenData ?? []) as BrokenRow[]

  console.error(`${broken.length} active rows report 0 kcal.`)

  // One batched payload fetch, keyed by fdc_id.
  const fdcIds = broken.map(r => r.fdc_id).filter((n): n is number => n != null)
  const payloads = new Map<string, USDANutrientEntry[]>()
  for (let i = 0; i < fdcIds.length; i += CHUNK) {
    const slice = fdcIds.slice(i, i + CHUNK).map(String)
    const { data, error: payloadError } = await supabase
      .from('source_payloads')
      .select('external_id,payload')
      .eq('source', 'usda')
      .in('external_id', slice)
    if (payloadError) throw new Error(`fetch payloads: ${payloadError.message}`)
    for (const p of data ?? []) {
      const nutrients = (p.payload as { foodNutrients?: USDANutrientEntry[] })
        ?.foodNutrients
      if (Array.isArray(nutrients)) payloads.set(String(p.external_id), nutrients)
    }
  }

  const results: Result[] = broken.map(row => {
    const entries = row.fdc_id != null ? payloads.get(String(row.fdc_id)) : undefined
    if (!entries) {
      return { row, outcome: 'no_payload', kcal: 0, via: '—' }
    }
    const amounts = amountMap(entries)
    // Prefer the payload's own macros: they are what a fresh import would use,
    // and they agree with the stored row in every case measured.
    const macros = {
      protein: amounts.get(ids.PROTEIN) ?? Number(row.protein_g ?? 0),
      carbs: amounts.get(ids.CARBS) ?? Number(row.carbs_g ?? 0),
      fat: amounts.get(ids.FAT) ?? Number(row.fat_g ?? 0),
    }
    const kcal = resolveEnergyKcal(amounts, macros)
    if (kcal <= 0) return { row, outcome: 'empty_shell', kcal: 0, via: '—' }

    const via =
      amounts.get(ids.ENERGY_KCAL)! > 0
        ? '1008'
        : (amounts.get(ids.ENERGY_ATWATER_SPECIFIC) ?? 0) > 0
          ? '2048 (Atwater specific)'
          : (amounts.get(ids.ENERGY_ATWATER_GENERAL) ?? 0) > 0
            ? '2047 (Atwater general)'
            : 'derived 4/4/9'
    return {
      row,
      outcome: via === 'derived 4/4/9' ? 'derived' : 'repaired',
      kcal,
      via,
    }
  })

  const by = (outcome: Outcome) => results.filter(r => r.outcome === outcome)
  const fixable = results.filter(r => r.kcal > 0)

  console.error(`  repairable from a stored energy nutrient: ${by('repaired').length}`)
  console.error(`  derivable from macros (4/4/9):            ${by('derived').length}`)
  console.error(`  empty shells (no energy, no macros):      ${by('empty_shell').length}`)
  console.error(`  no stored payload:                        ${by('no_payload').length}`)

  if (APPLY) {
    console.error(`\nApplying ${fixable.length} updates...`)
    let done = 0
    for (const r of fixable) {
      const { error: updateError } = await supabase
        .from('foods')
        .update({ calories_per_serving: r.kcal })
        .eq('id', r.row.id)
      if (updateError) {
        throw new Error(`update ${r.row.name}: ${updateError.message}`)
      }
      if (++done % 50 === 0) console.error(`  ${done}/${fixable.length}`)
    }
    console.error(`  ${done}/${fixable.length}`)
  }

  writeReport(results, by)

  if (by('empty_shell').length > 0 || by('no_payload').length > 0) {
    console.error(
      `\n${by('empty_shell').length + by('no_payload').length} row(s) could NOT be ` +
        'repaired from stored data — listed in the report. They need a fresh FDC ' +
        'fetch (scripts/022) or manual curation; this script will not guess a value.'
    )
  }
  console.error(
    APPLY ? '\nDone.' : '\nDry run — nothing written. Re-run with --apply.'
  )
}

function writeReport(results: Result[], by: (o: Outcome) => Result[]) {
  const lines: string[] = []
  lines.push('# Zero-calorie food backfill')
  lines.push('')
  lines.push(`Generated ${new Date().toISOString()} by \`scripts/029_backfill_zero_calorie_foods.ts\`${APPLY ? ' (APPLIED)' : ' (dry run)'}.`)
  lines.push('')
  lines.push(
    'Foundation foods report energy under FDC nutrients 2047/2048, never 1008. ' +
      'The importer read 1008 only, so every Foundation row landed at 0 kcal.'
  )
  lines.push('')
  lines.push('| outcome | rows |')
  lines.push('|---|---:|')
  lines.push(`| repaired from a stored energy nutrient | ${by('repaired').length} |`)
  lines.push(`| derived from macros (4/4/9) | ${by('derived').length} |`)
  lines.push(`| empty shell — no energy, no macros | ${by('empty_shell').length} |`)
  lines.push(`| no stored payload | ${by('no_payload').length} |`)
  lines.push(`| **total** | **${results.length}** |`)
  lines.push('')

  const defaults = results.filter(r => r.row.is_canonical_default)
  lines.push(
    `${defaults.length} of these are the DEFAULT variant of a canonical group — ` +
      'the row the variant picker shows first.'
  )
  lines.push('')

  lines.push('## Repaired')
  lines.push('')
  lines.push(
    '`via` records which FDC nutrient supplied the answer. Values from 1008 / ' +
      '2047 / 2048 are USDA-measured. Values marked **derived 4/4/9** are ' +
      'computed from macros and are approximations — for "Butter, stick, salted" ' +
      'that gives 740 against a published 717 (+3%), because general Atwater ' +
      'factors overestimate pure fats. That is a rounding error next to the ' +
      '-100% these rows carried before, but it is not a measured value.'
  )
  lines.push('')
  lines.push('| food | kcal/100g | via | group default |')
  lines.push('|---|---:|---|:---:|')
  for (const r of results
    .filter(r => r.kcal > 0)
    .sort((a, b) => b.kcal - a.kcal)) {
    lines.push(
      `| ${r.row.name} | ${Math.round(r.kcal)} | ${r.via} | ${r.row.is_canonical_default ? 'yes' : ''} |`
    )
  }
  lines.push('')

  const unfixed = [...by('empty_shell'), ...by('no_payload')]
  if (unfixed.length > 0) {
    lines.push('## Not repairable from stored data')
    lines.push('')
    lines.push(
      'These carry no energy nutrient AND no macros in the payload captured at ' +
        'import. Several are obviously wrong on their face — "Oil, peanut" is ' +
        '100% fat in reality — so the payload itself is sparse, not the parsing. ' +
        'They need a fresh FDC fetch or manual curation.'
    )
    lines.push('')
    lines.push('| food | fdc_id | protein | fat | carbs | group default |')
    lines.push('|---|---:|---:|---:|---:|:---:|')
    for (const r of unfixed) {
      lines.push(
        `| ${r.row.name} | ${r.row.fdc_id ?? '—'} | ${r.row.protein_g ?? 0} | ` +
          `${r.row.fat_g ?? 0} | ${r.row.carbs_g ?? 0} | ${r.row.is_canonical_default ? 'yes' : ''} |`
      )
    }
    lines.push('')
  }

  const path = auditPath('zero-calorie-backfill.md')
  writeFileSync(path, `${lines.join('\n')}\n`)
  console.error(`\nReport written to ${path}`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
