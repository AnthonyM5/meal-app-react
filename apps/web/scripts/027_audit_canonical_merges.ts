/**
 * Audit the canonical matcher's RISKIEST decisions: the silent auto-merges.
 *
 * WHY THIS EXISTS
 * `canonical_review_queue` only captures the 0.75-0.90 band — cases the
 * pipeline REFUSED to decide, which a human then reviews. Everything at or
 * above AUTO_MERGE_SIMILARITY (0.90) merged with no record and no review, and
 * a wrong merge is the expensive direction: it permanently fuses two foods'
 * nutrients under one key, where a wrong split merely shows a duplicate.
 *
 * So this replays scripts/026's matching offline and prints every auto-merge,
 * plus the two numbers that decide whether the threshold is calibrated:
 *
 *   highest QUEUED score   — the closest pair we correctly kept apart
 *   lowest AUTO-MERGE      — the closest pair we decided were the same
 *
 * They must not cross. On 2026-07-30 they were 0.892 (`pear_nectar` ~
 * `peach_nectar` — genuinely different fruit) and 0.900, i.e. the boundary sat
 * exactly between "different fruit" and the first real merge. Lowering the
 * threshold to 0.85 would have wrongly merged pear/peach nectar, milk with
 * vitamin A vs vitamin D, and plums with vs without added sugar.
 *
 * Read-only. Run it after ANY change to lib/food-name-parser.ts.
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/027_audit_canonical_merges.ts
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'
import { auditPath } from './_audit-path'
// The audit replays scripts/026's decisions, so it MUST run the exact
// similarity code and thresholds 026 ran — shared via _canonical-similarity.
import {
  AUTO_MERGE_SIMILARITY,
  REVIEW_SIMILARITY,
  similarity,
} from './_canonical-similarity'
import { fetchAllActiveFoods } from './_fetch-all'
import { parseFoodName } from '../lib/food-name-parser'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing env. Run: set -a && source .env.local && set +a  first.')
  process.exit(1)
}

const AUDIT_PATH = auditPath('canonical-merge-audit.md')

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface Decision {
  from: string
  into: string
  score: number
  name: string
}

async function main() {
  const rows = await fetchAllActiveFoods<{ id: string; name: string }>(
    supabase,
    'id,name'
  )

  const canonicals = new Set<string>()
  const merges: Decision[] = []
  const queued: Decision[] = []

  for (const row of rows) {
    const slug = parseFoodName(row.name).slug
    if (!slug || canonicals.has(slug)) continue

    let bestSlug = ''
    let bestScore = 0
    for (const candidate of canonicals) {
      const score = similarity(slug, candidate)
      if (score > bestScore) {
        bestScore = score
        bestSlug = candidate
      }
    }

    if (bestScore >= AUTO_MERGE_SIMILARITY) {
      merges.push({ from: slug, into: bestSlug, score: bestScore, name: row.name })
    } else {
      if (bestScore >= REVIEW_SIMILARITY) {
        queued.push({ from: slug, into: bestSlug, score: bestScore, name: row.name })
      }
      canonicals.add(slug)
    }
  }

  const highestQueued = queued.length ? Math.max(...queued.map(q => q.score)) : 0
  const lowestMerge = merges.length ? Math.min(...merges.map(m => m.score)) : 1

  console.error(`${rows.length} active rows -> ${canonicals.size} canonicals`)
  console.error(`  auto-merged (>= ${AUTO_MERGE_SIMILARITY}): ${merges.length}`)
  console.error(`  queued for review:                ${queued.length}`)
  console.error('')
  console.error(`  highest QUEUED (kept apart): ${highestQueued.toFixed(3)}`)
  console.error(`  lowest  AUTO-MERGE:          ${lowestMerge.toFixed(3)}`)

  const boundaryOk = highestQueued < lowestMerge
  console.error(
    boundaryOk
      ? `  OK — the threshold separates the two populations.`
      : `  WARNING — the populations OVERLAP. Some pair we merged scores lower ` +
          `than a pair we kept apart, so no single threshold is correct here. ` +
          `Fix the parser (normalize the difference away) rather than moving ` +
          `the threshold.`
  )

  console.error('\n  auto-merges:')
  for (const m of [...merges].sort((a, b) => a.score - b.score)) {
    console.error(`    ${m.score.toFixed(3)}  ${m.from}  ->  ${m.into}`)
  }

  writeFileSync(
    AUDIT_PATH,
    [
      '# Canonical merge audit',
      '',
      `_Generated ${new Date().toISOString().slice(0, 10)} by ` +
        `scripts/027_audit_canonical_merges.ts._`,
      '',
      `| Metric | Value |`,
      `|---|---|`,
      `| Active rows | ${rows.length} |`,
      `| Canonicals | ${canonicals.size} |`,
      `| Auto-merged (>= ${AUTO_MERGE_SIMILARITY}) | ${merges.length} |`,
      `| Queued for review | ${queued.length} |`,
      `| Highest queued (kept apart) | ${highestQueued.toFixed(3)} |`,
      `| Lowest auto-merge | ${lowestMerge.toFixed(3)} |`,
      `| Threshold separates cleanly | ${boundaryOk ? 'yes' : '**NO**'} |`,
      '',
      '## Auto-merges (silent — no review queue entry)',
      '',
      'Each line absorbed a distinct parsed slug into an existing canonical.',
      'Verify these are the SAME food; a wrong merge fuses nutrients.',
      '',
      '```',
      ...[...merges]
        .sort((a, b) => a.score - b.score)
        .map(m => `${m.score.toFixed(3)}  ${m.from}  ->  ${m.into}`),
      '```',
      '',
    ].join('\n')
  )
  console.error(`\n  Report written to ${AUDIT_PATH}`)

  process.exit(boundaryOk ? 0 : 1)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
