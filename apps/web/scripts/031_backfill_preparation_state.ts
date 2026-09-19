/**
 * Re-run `inferPreparationState()` over every `foods` row that still has a
 * NULL `preparation_state`, and store whatever the widened vocabulary can now
 * classify.
 *
 * WHY
 * `foods.preparation_state` is written by `lib/usda-canine.ts` at import and
 * read by `packages/core/src/search-query.ts` as a HARD filter: a query that
 * says "broiled" or "unprepared" narrows to rows whose column matches, and a
 * row the importer couldn't classify holds NULL and is excluded.
 *
 * The two halves had drifted. The importer's cooked list omitted `broiled`,
 * `pan-broiled`, `simmered`, `microwaved` and `oven-heated`, and its raw list
 * omitted `unheated` and `unprepared` — all seven of which the query parser
 * recognizes. Measured on the live corpus 2026-09-19:
 *
 *     broiled       6 NULL of 204     microwaved    4 of 12
 *     pan-broiled   3 of 23           oven-heated   1 of 6
 *     unheated     44 of 47           unprepared   55 of 66
 *
 * So "93% lean broiled turkey" hard-filtered away
 * "Turkey, ground, 93% lean, 7% fat, patties, broiled" — the row it named.
 * The vocabulary now lives once, in `@pawplate/core/food-vocab`
 * (`inferPrepState`), with a drift test tying the reader to it. This script
 * repairs the rows imported before that.
 *
 * WHAT IT WILL NOT DO
 * - It never clears or overwrites an existing state. NULL → value only.
 * - It never guesses. A row whose description says nothing about preparation
 *   stays NULL, which is the honest answer: NULL means "the importer could
 *   not tell", and search must treat it as unknown, not as raw.
 * - `smoked` stays NULL by design. Every smoked row in the corpus is
 *   cold-smoked fish or lox — cured, not cooked (see STATE_NEUTRAL_METHODS).
 *
 * Safe to re-run: it is idempotent, touches one column, and writes no rows on
 * a second pass. Reversible per row from the audit file it writes, which
 * records the id, name and the value set.
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/031_backfill_preparation_state.ts          # dry run
 *   npx tsx scripts/031_backfill_preparation_state.ts --apply
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'
import { auditPath } from './_audit-path'
import { fetchAllRows } from './_fetch-all'
import { inferPreparationState } from '../lib/usda-canine'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing env. Run: set -a && source .env.local && set +a  first.')
  process.exit(1)
}

const APPLY = process.argv.includes('--apply')

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface FoodRow {
  id: string
  name: string
  preparation_state: string | null
  is_active: boolean | null
}

interface Change {
  id: string
  name: string
  state: 'raw' | 'cooked'
  is_active: boolean
}

interface Disagreement {
  id: string
  name: string
  stored: string
  inferred: 'raw' | 'cooked' | null
}

async function main() {
  // Soft-deleted rows are included deliberately: `is_active` is reversible,
  // and a row reactivated later should not carry a stale NULL state.
  const rows = await fetchAllRows<FoodRow>(
    supabase,
    'foods',
    'id,name,preparation_state,is_active',
    { orderBy: 'name' }
  )

  const nullState = rows.filter(r => r.preparation_state == null)
  const changes: Change[] = []

  for (const row of nullState) {
    const state = inferPreparationState(row.name)
    if (!state) continue
    changes.push({
      id: row.id,
      name: row.name,
      state,
      is_active: row.is_active !== false,
    })
  }

  // Reported, never written. A stored value the classifier now disagrees with
  // is a judgement call, not a gap: overwriting one would silently restate a
  // nutrition fact, so it needs a human. Expected content as of 2026-09-19:
  // the two "Apples, raw, without skin, cooked, boiled" rows, where FDC's
  // family name says raw and the row itself is a boiled apple.
  const disagreements: Disagreement[] = rows
    .filter(r => r.preparation_state != null)
    .map(r => ({
      id: r.id,
      name: r.name,
      stored: r.preparation_state as string,
      inferred: inferPreparationState(r.name),
    }))
    .filter(d => d.inferred !== d.stored)

  const byState = { raw: 0, cooked: 0 }
  for (const c of changes) byState[c.state]++

  console.log(`foods rows              ${rows.length}`)
  console.log(`  preparation_state NULL  ${nullState.length}`)
  console.log(`  newly classifiable      ${changes.length}`)
  console.log(`    → raw                 ${byState.raw}`)
  console.log(`    → cooked              ${byState.cooked}`)
  console.log(`  still unknown           ${nullState.length - changes.length}`)
  console.log()

  for (const c of changes.slice(0, 25)) {
    console.log(`  ${c.state.padEnd(6)} ${c.name}`)
  }
  if (changes.length > 25) console.log(`  … ${changes.length - 25} more (see audit)`)

  if (disagreements.length) {
    console.log(`\n${disagreements.length} row(s) whose STORED state the classifier disagrees with.`)
    console.log('Not touched — review by hand:')
    for (const d of disagreements) {
      console.log(`  stored ${d.stored} / now ${d.inferred} — ${d.name}`)
    }
  }

  const out = auditPath('preparation-state-backfill.json')
  writeFileSync(
    out,
    JSON.stringify(
      { ranAt: new Date().toISOString(), applied: APPLY, changes, disagreements },
      null,
      2
    )
  )
  console.log(`\nAudit → ${out}`)

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to write.')
    return
  }

  let written = 0
  for (const c of changes) {
    // Re-assert the NULL precondition in the WHERE clause: a concurrent
    // import between the read above and this write must win, not be clobbered.
    const { error } = await supabase
      .from('foods')
      .update({ preparation_state: c.state })
      .eq('id', c.id)
      .is('preparation_state', null)
    if (error) {
      console.error(`  FAILED ${c.name}: ${error.message}`)
      continue
    }
    written++
  }
  console.log(`\nUpdated ${written}/${changes.length} rows.`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
