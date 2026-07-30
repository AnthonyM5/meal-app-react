/**
 * Build the canonical ingredient layer over `foods`
 * (docs/DATA_NORMALIZATION_DESIGN.md §4.3).
 *
 * For every active row: parse the description, derive a canonical slug, match
 * it against existing canonicals, and attach the row as a variant. Exact-slug
 * hits merge; near-misses in the ambiguous band go to a review queue rather
 * than being guessed at; everything else creates a new canonical.
 *
 *   >= AUTO_MERGE_SIMILARITY (0.90)  -> merge into the matched canonical
 *   0.75 .. 0.90                     -> canonical_review_queue, kept separate
 *   <  REVIEW_SIMILARITY   (0.75)    -> new canonical
 *
 * Matching runs in-process against the canonical set (a few thousand slugs)
 * rather than per-row in SQL — same trigram Jaccard pg_trgm uses, no round
 * trip per row.
 *
 * NON-DESTRUCTIVE: only writes canonical_id / variant_attrs /
 * is_canonical_default on `foods`. No name is rewritten, no row is deleted,
 * no nutrient value is touched. Re-runnable: `--reset` clears the layer and
 * rebuilds from scratch.
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/026_build_canonical_ingredients.ts            # dry run
 *   npx tsx scripts/026_build_canonical_ingredients.ts --apply
 *   npx tsx scripts/026_build_canonical_ingredients.ts --apply --reset
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'
import { auditPath } from './_audit-path'
import { parseFoodName, type ParsedFoodName } from '../lib/food-name-parser'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing env. Run: set -a && source .env.local && set +a  first.')
  process.exit(1)
}

const APPLY = process.argv.includes('--apply')
const RESET = process.argv.includes('--reset')
const AUDIT_PATH = auditPath('canonical-ingredients.md')

/** Above this, two slugs are the same ingredient. */
const AUTO_MERGE_SIMILARITY = 0.9
/** Below this, they are different ingredients. Between = human review. */
const REVIEW_SIMILARITY = 0.75

const CHUNK = 200

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface FoodRow {
  id: string
  name: string
  food_category: string | null
  usda_data_type: string | null
  source: string | null
  is_verified: boolean | null
  is_safe_for_dogs: boolean | null
  preparation_state: string | null
  fdc_id: number | null
}

interface Canonical {
  slug: string
  displayName: string
  baseFood: string
  part: string | null
  members: Array<{ row: FoodRow; parsed: ParsedFoodName }>
}

// ---------------------------------------------------------------------------
// Trigram similarity — the same metric pg_trgm's similarity() computes, so
// the thresholds here mean the same thing they would in SQL.
// ---------------------------------------------------------------------------

function trigrams(text: string): Set<string> {
  const out = new Set<string>()
  for (const word of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    const padded = `  ${word} `
    for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3))
  }
  return out
}

function similarity(a: string, b: string): number {
  const ta = trigrams(a)
  const tb = trigrams(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let shared = 0
  for (const t of ta) if (tb.has(t)) shared++
  return shared / (ta.size + tb.size - shared)
}

/** Most frequent non-null value, for rolling variant categories up. */
function majority(values: Array<string | null>): string | null {
  const counts = new Map<string, number>()
  for (const v of values) {
    if (!v) continue
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  let best: string | null = null
  let bestCount = 0
  for (const [v, n] of counts) {
    if (n > bestCount) {
      best = v
      bestCount = n
    }
  }
  return best
}

/**
 * Pick the variant the picker shows when a group is collapsed. Deterministic
 * and recomputable — never a stored human choice.
 */
function pickDefault(members: Canonical['members']): FoodRow {
  const scored = members.map(({ row, parsed }) => {
    let score = 0
    if (row.is_verified) score += 1000
    if (row.usda_data_type === 'Foundation') score += 500 // better micro coverage
    if (row.preparation_state === 'raw') score += 100 // fresh-feeding default
    if (row.source === 'usda' || row.source === 'curated') score += 50
    // Prefer the least-qualified variant: every extra attribute is a
    // specialization the owner did not ask for.
    const specificity =
      parsed.attrs.trim.length +
      parsed.attrs.grade.length +
      parsed.attrs.origin.length +
      parsed.attrs.residual.length
    score -= specificity * 10
    score -= row.name.length / 100
    return { row, score }
  })
  scored.sort((a, b) => b.score - a.score || a.row.name.localeCompare(b.row.name))
  return scored[0].row
}

async function fetchAllFoods(): Promise<FoodRow[]> {
  const rows: FoodRow[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from('foods')
      .select(
        'id,name,food_category,usda_data_type,source,is_verified,' +
          'is_safe_for_dogs,preparation_state,fdc_id'
      )
      .eq('is_active', true)
      .order('name')
      .range(offset, offset + 999)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...(data as unknown as FoodRow[]))
    if (data.length < 1000) break
  }
  return rows
}

async function reset() {
  console.error('Resetting canonical layer...')
  const { error: foodsError } = await supabase
    .from('foods')
    .update({ canonical_id: null, variant_attrs: null, is_canonical_default: false })
    .not('canonical_id', 'is', null)
  if (foodsError) throw foodsError
  for (const table of ['canonical_review_queue', 'canonical_ingredients'] as const) {
    const { error } = await supabase.from(table).delete().neq('id', NIL_UUID)
    if (error) throw error
  }
}

const NIL_UUID = '00000000-0000-0000-0000-000000000000'

async function main() {
  if (RESET && APPLY) await reset()

  const rows = await fetchAllFoods()
  console.error(`Parsing ${rows.length} active rows...\n`)

  // ---- 1. parse + 2. bucket by slug, with 3. fuzzy matching for near-misses
  const canonicals = new Map<string, Canonical>()
  const reviewQueue: Array<{
    row: FoodRow
    proposedSlug: string
    matchedSlug: string
    similarity: number
  }> = []

  for (const row of rows) {
    const parsed = parseFoodName(row.name)
    const slug = parsed.slug
    if (!slug) continue

    const exact = canonicals.get(slug)
    if (exact) {
      exact.members.push({ row, parsed })
      continue
    }

    // No exact hit — find the closest existing canonical.
    let bestSlug = ''
    let bestScore = 0
    for (const candidate of canonicals.keys()) {
      const score = similarity(slug, candidate)
      if (score > bestScore) {
        bestScore = score
        bestSlug = candidate
      }
    }

    if (bestScore >= AUTO_MERGE_SIMILARITY) {
      canonicals.get(bestSlug)!.members.push({ row, parsed })
    } else {
      if (bestScore >= REVIEW_SIMILARITY) {
        // Ambiguous: keep it separate (the conservative choice — a wrong
        // merge silently fuses two foods' nutrients) but flag it for review.
        reviewQueue.push({
          row,
          proposedSlug: slug,
          matchedSlug: bestSlug,
          similarity: bestScore,
        })
      }
      canonicals.set(slug, {
        slug,
        displayName: parsed.displayName,
        baseFood: parsed.baseFood,
        part: parsed.part,
        members: [{ row, parsed }],
      })
    }
  }

  // ---- report ----
  const sorted = [...canonicals.values()].sort(
    (a, b) => b.members.length - a.members.length
  )
  const singletons = sorted.filter(c => c.members.length === 1).length
  const residualRows = rows.filter(r => parseFoodName(r.name).attrs.residual.length > 0)

  console.error(`  canonical keys:      ${canonicals.size}`)
  console.error(`  singleton keys:      ${singletons}`)
  console.error(`  review-queue items:  ${reviewQueue.length}`)
  console.error(`  rows with residuals: ${residualRows.length}`)
  console.error(`\n  largest groups:`)
  for (const c of sorted.slice(0, 12)) {
    console.error(`    ${String(c.members.length).padStart(4)}  ${c.slug}`)
  }

  const residualTerms = new Map<string, number>()
  for (const row of rows) {
    for (const term of parseFoodName(row.name).attrs.residual) {
      residualTerms.set(term, (residualTerms.get(term) ?? 0) + 1)
    }
  }

  const lines: string[] = [
    '# Canonical ingredient build',
    '',
    `_Generated ${new Date().toISOString().slice(0, 10)} by ` +
      `scripts/026_build_canonical_ingredients.ts (${APPLY ? 'APPLIED' : 'DRY RUN'})._`,
    '',
    `| Metric | Value |`,
    `|---|---|`,
    `| Active rows | ${rows.length} |`,
    `| Canonical keys | ${canonicals.size} |`,
    `| Singleton keys | ${singletons} |`,
    `| Review-queue items | ${reviewQueue.length} |`,
    `| Rows with unparsed segments | ${residualRows.length} |`,
    '',
    '## Largest groups',
    '',
    '```',
    ...sorted.slice(0, 40).map(c => `${String(c.members.length).padStart(5)}  ${c.slug}`),
    '```',
    '',
    '## Top unclassified residual terms',
    '',
    'Each is a gazetteer gap in `lib/food-name-parser.ts`. Adding the frequent',
    'ones there is the cheapest way to improve grouping quality.',
    '',
    '```',
    ...[...residualTerms.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([t, n]) => `${String(n).padStart(5)}  ${t}`),
    '```',
    '',
    '## Review queue',
    '',
    `${reviewQueue.length} rows landed between ${REVIEW_SIMILARITY} and ` +
      `${AUTO_MERGE_SIMILARITY} similarity against an existing canonical. They were ` +
      'KEPT SEPARATE (the conservative choice) and queued. Resolve each by adding a',
    'SYNONYMS entry in `lib/food-name-parser.ts`, then re-run with `--reset`.',
    '',
    '```',
    ...reviewQueue
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 60)
      .map(q => `${q.similarity.toFixed(3)}  ${q.proposedSlug}  ~  ${q.matchedSlug}`),
    '```',
    '',
  ]
  writeFileSync(AUDIT_PATH, lines.join('\n'))
  console.error(`\n  Report written to ${AUDIT_PATH}`)

  if (!APPLY) {
    console.error('\nDry run — nothing written. Re-run with --apply.')
    return
  }

  // ---- 4. write canonicals ----
  console.error('\nWriting canonical_ingredients...')
  const canonicalRows = sorted.map(c => ({
    slug: c.slug,
    display_name: c.displayName,
    base_food: c.baseFood,
    part: c.part,
    category: majority(c.members.map(m => m.row.food_category)),
    // Only flag the GROUP unsafe when every variant is — a group holding one
    // toxic variant among safe ones must not read as toxic wholesale.
    is_safe_for_dogs: c.members.some(m => m.row.is_safe_for_dogs !== false),
    variant_count: c.members.length,
  }))

  for (let i = 0; i < canonicalRows.length; i += CHUNK) {
    const { error } = await supabase
      .from('canonical_ingredients')
      .upsert(canonicalRows.slice(i, i + CHUNK), { onConflict: 'slug' })
    if (error) throw error
  }

  // MUST paginate: PostgREST caps an unbounded select at 1,000 rows, and
  // there are ~1,432 canonicals. Fetching without a range silently truncated
  // this map, so every canonical past the first 1,000 was skipped in the
  // attach loop below and its rows kept canonical_id = NULL.
  const idBySlug = new Map<string, string>()
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from('canonical_ingredients')
      .select('id,slug')
      .order('slug')
      .range(offset, offset + 999)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const r of data) idBySlug.set(r.slug as string, r.id as string)
    if (data.length < 1000) break
  }
  if (idBySlug.size !== canonicalRows.length) {
    throw new Error(
      `Canonical id map is incomplete: ${idBySlug.size} fetched vs ` +
        `${canonicalRows.length} written. Refusing to attach variants.`
    )
  }

  // ---- 5. attach variants ----
  console.error('Attaching variants...')
  // Clear defaults first: the partial unique index allows only one default
  // per canonical, so a stale default would collide with the new one.
  const { error: clearError } = await supabase
    .from('foods')
    .update({ is_canonical_default: false })
    .eq('is_canonical_default', true)
  if (clearError) throw clearError

  let attached = 0
  for (const c of sorted) {
    const canonicalId = idBySlug.get(c.slug)
    if (!canonicalId) continue
    const defaultRow = pickDefault(c.members)

    for (const { row, parsed } of c.members) {
      const { error } = await supabase
        .from('foods')
        .update({
          canonical_id: canonicalId,
          variant_attrs: parsed.attrs,
          is_canonical_default: row.id === defaultRow.id,
        })
        .eq('id', row.id)
      if (error) throw error
      attached++
    }
    if (attached % 500 === 0) console.error(`  ${attached}/${rows.length}`)
  }

  // ---- 6. review queue ----
  if (reviewQueue.length > 0) {
    const queueRows = reviewQueue.map(q => ({
      food_id: q.row.id,
      food_name: q.row.name,
      proposed_slug: q.proposedSlug,
      matched_slug: q.matchedSlug,
      similarity: q.similarity,
      status: 'pending' as const,
    }))
    for (let i = 0; i < queueRows.length; i += CHUNK) {
      const { error } = await supabase
        .from('canonical_review_queue')
        .upsert(queueRows.slice(i, i + CHUNK), { onConflict: 'food_id' })
      if (error) throw error
    }
  }

  console.error(
    `\nDone. ${canonicalRows.length} canonicals, ${attached} variants attached, ` +
      `${reviewQueue.length} queued for review.`
  )
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
