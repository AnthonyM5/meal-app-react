/**
 * Soft-delete the prepared-food leakage that scripts/022's category whitelist
 * admitted (docs/DATA_NORMALIZATION_DESIGN.md §3.2).
 *
 * WHY SOFT DELETE, NOT DELETE
 * `meal_items.food_id` and `recipe_ingredients.food_id` are both
 * `REFERENCES public.foods(id) ON DELETE CASCADE NOT NULL`. A hard DELETE
 * here would silently destroy any meal an owner had already logged against
 * one of these rows. So this flips `is_active = false` instead: the row
 * vanishes from `fuzzy_search_foods` (which now filters on is_active) but
 * stays resolvable by id, so historical meals keep rendering.
 *
 * Fully reversible:
 *   UPDATE foods SET is_active = true, inactive_reason = NULL
 *    WHERE inactive_reason LIKE 'prune:%';
 *
 * The rule set lives in lib/food-relevance.ts so the importer and this script
 * agree on what "not a dog food" means. Validated against all 5,029 live rows
 * on 2026-07-29: 274 matches (5.4%), reviewed by hand for false positives —
 * the one found ("Squash, pie pumpkin, peeled, seeded, raw", a legitimate raw
 * squash) is excluded by a negative lookahead in the baked_snack rule.
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/024_prune_prepared_foods.ts              # dry run (default)
 *   npx tsx scripts/024_prune_prepared_foods.ts --apply
 *   npx tsx scripts/024_prune_prepared_foods.ts --revert
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'
import { auditPath } from './_audit-path'
import { fetchAllActiveFoods } from './_fetch-all'
import { PRUNE_RULES, matchPruneRule } from '../lib/food-relevance'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing env. Run: set -a && source .env.local && set +a  first.')
  process.exit(1)
}

const APPLY = process.argv.includes('--apply')
const REVERT = process.argv.includes('--revert')
const AUDIT_PATH = auditPath('prune-prepared-foods.md')

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const CHUNK = 200

async function revert() {
  const { data, error } = await supabase
    .from('foods')
    .update({ is_active: true, inactive_reason: null })
    .like('inactive_reason', 'prune:%')
    .select('id')
  if (error) throw error
  console.error(`Reactivated ${data?.length ?? 0} rows.`)
}

async function main() {
  if (REVERT) return revert()

  // Pull every currently-active row; the rules run on the description.
  const rows = await fetchAllActiveFoods<{ id: string; name: string }>(
    supabase,
    'id,name'
  )
  console.error(`Scanned ${rows.length} active rows.`)

  // Attribute each match to the FIRST rule that fires, so the audit groups
  // cleanly and inactive_reason is deterministic.
  const matches = new Map<string, Array<{ id: string; name: string }>>()
  for (const row of rows) {
    const rule = matchPruneRule(row.name)
    if (!rule) continue
    if (!matches.has(rule.id)) matches.set(rule.id, [])
    matches.get(rule.id)!.push({ id: row.id, name: row.name })
  }

  const total = [...matches.values()].reduce((n, list) => n + list.length, 0)

  // Anything an owner already logged is worth surfacing before we hide it —
  // it means a real user picked this row, so the rule may be too aggressive.
  const allIds = [...matches.values()].flat().map(m => m.id)
  const inUse = new Set<string>()
  for (let i = 0; i < allIds.length; i += CHUNK) {
    const slice = allIds.slice(i, i + CHUNK)
    for (const table of ['meal_items', 'recipe_ingredients'] as const) {
      const { data, error } = await supabase
        .from(table)
        .select('food_id')
        .in('food_id', slice)
      if (error) throw error
      for (const r of data ?? []) inUse.add(r.food_id as string)
    }
  }

  // ---- report ----
  const lines: string[] = [
    '# Prune audit — prepared foods soft-deleted from `foods`',
    '',
    `_Generated ${new Date().toISOString().slice(0, 10)} by ` +
      `scripts/024_prune_prepared_foods.ts (${APPLY ? 'APPLIED' : 'DRY RUN'})._`,
    '',
    `Scanned **${rows.length}** active rows; matched **${total}** ` +
      `(${((100 * total) / rows.length).toFixed(1)}%).`,
    '',
    'Rules live in `apps/web/lib/food-relevance.ts`. Reverse with `--revert`.',
    '',
  ]

  console.error('')
  for (const rule of PRUNE_RULES) {
    const hits = matches.get(rule.id) ?? []
    console.error(`  ${String(hits.length).padStart(4)}  ${rule.id}`)
    lines.push(`## \`${rule.id}\` — ${hits.length} rows`, '', `${rule.why}`, '')
    lines.push('```')
    for (const h of hits) {
      lines.push(`${inUse.has(h.id) ? '[IN USE] ' : ''}${h.name}`)
    }
    lines.push('```', '')
  }

  if (inUse.size > 0) {
    console.error(
      `\n  WARNING: ${inUse.size} matched row(s) are referenced by existing ` +
        `meal_items/recipe_ingredients. They stay resolvable by id (soft ` +
        `delete), but review them in ${AUDIT_PATH} — an owner chose them ` +
        `deliberately, so a rule may be too broad.`
    )
    lines.push(
      `## In use`,
      '',
      `${inUse.size} matched rows are referenced by logged meals or recipes. ` +
        `Soft delete keeps those rendering, but consider narrowing the rule.`,
      ''
    )
  }

  writeFileSync(AUDIT_PATH, lines.join('\n'))
  console.error(`\n  Report written to ${AUDIT_PATH}`)

  if (!APPLY) {
    console.error(
      `\nDry run — nothing written to the database. ` +
        `Re-run with --apply to deactivate ${total} rows.`
    )
    return
  }

  // ---- apply ----
  let updated = 0
  for (const rule of PRUNE_RULES) {
    const hits = matches.get(rule.id) ?? []
    for (let i = 0; i < hits.length; i += CHUNK) {
      const slice = hits.slice(i, i + CHUNK).map(h => h.id)
      const { error } = await supabase
        .from('foods')
        .update({ is_active: false, inactive_reason: `prune:${rule.id}` })
        .in('id', slice)
      if (error) throw error
      updated += slice.length
    }
    if (hits.length) console.error(`  deactivated ${hits.length} (${rule.id})`)
  }
  console.error(`\nDone. Deactivated ${updated} rows. Revert with --revert.`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
