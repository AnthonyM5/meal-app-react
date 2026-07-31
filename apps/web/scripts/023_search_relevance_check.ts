/**
 * Search relevance regression harness for fuzzy_search_foods.
 *
 * WHY THIS EXISTS
 * The Jest suite deliberately never hits the network, so it cannot test a
 * ranking function that lives in SQL. Without a harness, relevance
 * regressions are invisible: the 20260712000200 `word_similarity` change
 * looked correct, passed every test, and silently made "beef" return
 * "Beans, baked, canned, with beef" once the corpus grew to 5,029 rows.
 *
 * This runs the real RPC against a real database and asserts NAMED
 * EXPECTATIONS about what the top hit must be. Exits non-zero on any
 * regression, so it can gate a deploy.
 *
 * It also checks the MATCH_THRESHOLD separation: labels that should resolve
 * locally must score above it, and branded/DTC labels that should fall
 * through to the Open Food Facts suggestion path must score below it.
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/023_search_relevance_check.ts
 *   npx tsx scripts/023_search_relevance_check.ts --verbose   # show top 5 per query
 */

import { createClient } from '@supabase/supabase-js'
import { MATCH_THRESHOLD } from '../lib/resolve-ingredient'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing env. Run: set -a && source .env.local && set +a  first.')
  process.exit(1)
}

const VERBOSE = process.argv.includes('--verbose')

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface SearchRow {
  id: string
  name: string
  source: string | null
  similarity: number
}

/**
 * Named expectations. Each asserts the TOP hit is a plausible default answer,
 * not merely a row containing the query term — the looser "contains the word"
 * assertion is exactly what let the alphabetical-ordering bug through.
 *
 * The weights in migration 20260729000100 were fitted against these cases
 * over a 5,966-point grid. Baselines on the 5,029-row corpus:
 *   old saturating score 13/18 | blended 17/18 | blended + pruning 18/18
 */
const RELEVANCE_CASES: Array<{
  query: string
  expect: (name: string) => boolean
  why: string
}> = [
  // ---- generic base-food queries: want a short, generic row of that food ----
  {
    query: 'beef',
    expect: n => /^beef,/i.test(n) && segments(n) <= 4,
    why: 'a generic beef cut, not a 9-segment Wagyu marble-score variant',
  },
  {
    query: 'chicken',
    expect: n =>
      /^chicken,/i.test(n) &&
      segments(n) <= 3 &&
      !/meatless|canned/i.test(n),
    why: 'real chicken — NOT "Chicken, meatless" (a soy product)',
  },
  {
    query: 'pork',
    expect: n =>
      /^pork,/i.test(n) && segments(n) <= 3 && !/cured|pickled/i.test(n),
    why: 'fresh pork, not cured/pickled',
  },
  {
    query: 'rice',
    expect: n => /^rice,/i.test(n) && segments(n) <= 3,
    why: 'actual rice, not "Noodles, chinese, cellophane or long rice" or "Oil, rice bran"',
  },
  {
    query: 'salmon',
    expect: n => /salmon/i.test(n) && !/oil|nugget/i.test(n),
    why: 'the fish, not salmon oil or breaded nuggets',
  },
  {
    query: 'egg',
    expect: n => /^egg,/i.test(n) && !/substitute/i.test(n),
    why: 'a real egg, not an egg substitute',
  },
  {
    query: 'pumpkin',
    expect: n => /^pumpkin/i.test(n) && !/seed/i.test(n),
    why: 'pumpkin flesh, not "Fish, sunfish, pumpkin seed"',
  },
  { query: 'quinoa', expect: n => /^quinoa/i.test(n), why: 'grain, not quinoa flour' },
  {
    query: 'blueberries',
    expect: n => /^blueberries/i.test(n) && !/syrup/i.test(n),
    why: 'plain berries, not canned in heavy syrup',
  },
  // ---- base + cut/part queries ----
  {
    query: 'chicken breast',
    expect: n => /chicken/i.test(n) && /breast/i.test(n) && !/breaded|tender/i.test(n),
    why: 'a breast cut, not breaded chicken breast tenders',
  },
  {
    query: 'ground turkey',
    expect: n => /turkey/i.test(n) && /ground/i.test(n),
    why: 'ground turkey in any prep state',
  },
  {
    query: 'chicken liver',
    expect: n => /chicken/i.test(n) && /liver/i.test(n),
    why: 'the organ meat',
  },
  {
    query: 'beef liver',
    expect: n => /beef/i.test(n) && /liver/i.test(n),
    why: 'the organ meat, not a beef cut',
  },
  {
    query: 'sweet potato',
    expect: n =>
      /^sweet potato/i.test(n) && segments(n) <= 3 && !/candied|puff/i.test(n),
    why: 'plain sweet potato, not candied or frozen puffs',
  },
  {
    query: 'green beans',
    expect: n => /beans/i.test(n) && /(snap|green)/i.test(n),
    why: 'green/snap beans',
  },
  { query: 'oatmeal', expect: n => /oat/i.test(n), why: 'oats in some form' },
  // ---- typo tolerance must survive any ranking change ----
  {
    query: 'chiken liver',
    expect: n => /chicken/i.test(n) && /liver/i.test(n),
    why: 'trigram typo tolerance (the pre-PawPlate smoke test case)',
  },
  {
    query: 'swet potato',
    expect: n => /sweet potato/i.test(n),
    why: 'trigram typo tolerance',
  },
]

/**
 * Threshold separation cases. `matchLocalIngredient` accepts the single top
 * hit when it scores >= MATCH_THRESHOLD, so the floor has to sit in the gap
 * between these two groups. If the gap closes, the bowl resolver either
 * rejects real ingredients or silently matches branded products to whole
 * foods — both are worse than showing "no match".
 */
const SHOULD_RESOLVE = [
  'chicken breast',
  'ground turkey',
  'chicken liver',
  'sweet potato',
  'salmon',
  'blueberries',
  'pumpkin',
  'beef liver',
  'white rice',
  'carrots',
  'broccoli',
  'green beans',
  'egg',
  'beef',
  'chiken liver',
  'swet potato',
]

const SHOULD_NOT_RESOLVE = [
  "the farmer's dog turkey recipe",
  'kibble',
  'dental chew',
  'bully stick',
  'purina pro plan',
  'freeze-dried raw topper',
  'bone broth cubes',
  'greenies',
  'zignature lamb formula',
  'multivitamin powder',
]

/** Comma-segment count — mirrors public.food_name_segments(). */
function segments(name: string): number {
  return Math.max(name.split(',').length, 1)
}

async function search(query: string, limit = 5): Promise<SearchRow[]> {
  const { data, error } = await supabase.rpc('fuzzy_search_foods', {
    search_query: query,
    match_limit: limit,
  })
  if (error) throw new Error(`RPC failed for ${quoted(query)}: ${error.message}`)
  return (data ?? []) as SearchRow[]
}

/** Quote a query for log output without a template-literal escaping mess. */
function quoted(s: string): string {
  return JSON.stringify(s)
}

async function main() {
  let failures = 0

  console.error('=== Relevance: top hit must be a plausible default ===')
  for (const testCase of RELEVANCE_CASES) {
    const rows = await search(testCase.query, VERBOSE ? 5 : 1)
    const top = rows[0]
    if (!top) {
      console.error(`  FAIL  ${quoted(testCase.query)} -> no results at all`)
      failures++
      continue
    }
    const ok = testCase.expect(top.name)
    if (!ok) failures++
    console.error(
      `  ${ok ? 'pass' : 'FAIL'}  ${top.similarity.toFixed(3)}  ` +
        `${quoted(testCase.query).padEnd(20)} -> ${top.name.slice(0, 62)}`
    )
    if (!ok) console.error(`        expected: ${testCase.why}`)
    if (VERBOSE) {
      for (const r of rows.slice(1)) {
        console.error(`               ${r.similarity.toFixed(3)}  ${r.name.slice(0, 62)}`)
      }
    }
  }

  console.error(`\n=== Threshold separation (MATCH_THRESHOLD = ${MATCH_THRESHOLD}) ===`)
  let minShould = 1
  let maxShouldNot = 0

  for (const label of SHOULD_RESOLVE) {
    const top = (await search(label, 1))[0]
    const score = top?.similarity ?? 0
    minShould = Math.min(minShould, score)
    if (score < MATCH_THRESHOLD) {
      failures++
      console.error(
        `  FAIL  ${score.toFixed(3)} < ${MATCH_THRESHOLD}  ${quoted(label)} ` +
          `should resolve locally (top: ${top?.name ?? 'none'})`
      )
    }
  }

  for (const label of SHOULD_NOT_RESOLVE) {
    const top = (await search(label, 1))[0]
    const score = top?.similarity ?? 0
    maxShouldNot = Math.max(maxShouldNot, score)
    if (score >= MATCH_THRESHOLD) {
      failures++
      console.error(
        `  FAIL  ${score.toFixed(3)} >= ${MATCH_THRESHOLD}  ${quoted(label)} ` +
          `should NOT auto-match (got: ${top?.name})`
      )
    }
  }

  console.error(
    `  should-resolve floor:     ${minShould.toFixed(3)}\n` +
      `  should-not-resolve ceiling: ${maxShouldNot.toFixed(3)}\n` +
      `  gap: ${(minShould - maxShouldNot).toFixed(3)} ` +
      `(MATCH_THRESHOLD ${MATCH_THRESHOLD} must sit inside it)`
  )
  if (minShould <= maxShouldNot) {
    console.error(
      '  FAIL  the two groups OVERLAP — no threshold can separate them. ' +
        'The scoring formula needs work, not the threshold.'
    )
    failures++
  }

  console.error(
    `\n${failures === 0 ? 'OK' : `FAILED (${failures} problem(s))`} — ` +
      `${RELEVANCE_CASES.length} relevance cases, ` +
      `${SHOULD_RESOLVE.length + SHOULD_NOT_RESOLVE.length} threshold cases`
  )
  process.exit(failures === 0 ? 0 : 1)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
