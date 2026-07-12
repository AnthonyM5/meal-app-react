/**
 * Audit-plan AC #2 (`NUTRIENT_API_SOURCING_AND_AUDIT.md` §3.2, raw/cooked
 * portion). For each PawPlate staple (audits/pawplate-staple-ingredients.md),
 * query USDA Foundation + SR Legacy, classify every result's preparation state
 * via the app's own `inferPreparationState()`, and assert that the variants we
 * *expect* actually exist in FDC. Read-only — no DB writes, no imports.
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/019_audit_raw_cooked_gaps.ts
 *
 * Writes: audits/usda-raw-cooked-gaps.json (machine-readable) and prints a
 * markdown table to stdout for pasting into audits/usda-food-coverage.md.
 */

import { writeFileSync } from 'fs'
import { inferPreparationState } from '../lib/usda-canine'

const usdaKey = process.env.USDA_API_KEY || process.env.NEXT_PUBLIC_USDA_API_KEY
if (!usdaKey) {
  console.error('Missing USDA key. Run: set -a && source .env.local && set +a  first.')
  process.exit(1)
}
const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1'

/** What preparation states we expect to be available in FDC for this staple. */
type Expect = 'both' | 'raw_only' | 'cooked_only'

interface Staple {
  name: string
  query: string
  expect: Expect
  category: string
}

const STAPLES: Staple[] = [
  // Muscle meats — both raw and cooked exist
  { category: 'Muscle meat', name: 'Chicken breast', query: 'chicken breast meat only', expect: 'both' },
  { category: 'Muscle meat', name: 'Chicken thigh', query: 'chicken thigh meat only', expect: 'both' },
  { category: 'Muscle meat', name: 'Turkey (ground)', query: 'turkey ground', expect: 'both' },
  { category: 'Muscle meat', name: 'Beef (ground, lean)', query: 'beef ground 90% lean', expect: 'both' },
  { category: 'Muscle meat', name: 'Lamb (ground)', query: 'lamb ground', expect: 'both' },
  { category: 'Muscle meat', name: 'Pork (tenderloin)', query: 'pork tenderloin', expect: 'both' },
  // Organ meats
  { category: 'Organ', name: 'Chicken liver', query: 'chicken liver', expect: 'both' },
  { category: 'Organ', name: 'Beef liver', query: 'beef liver', expect: 'both' },
  { category: 'Organ', name: 'Beef kidney', query: 'beef kidney', expect: 'both' },
  { category: 'Organ', name: 'Beef heart', query: 'beef heart', expect: 'both' },
  // Fish
  { category: 'Fish', name: 'Salmon (Atlantic)', query: 'salmon atlantic', expect: 'both' },
  { category: 'Fish', name: 'Sardine', query: 'sardine atlantic', expect: 'cooked_only' },
  { category: 'Fish', name: 'Tuna (yellowfin)', query: 'tuna yellowfin fresh', expect: 'both' },
  { category: 'Fish', name: 'Whitefish (cod)', query: 'cod atlantic', expect: 'both' },
  { category: 'Fish', name: 'Mackerel (Atlantic)', query: 'mackerel atlantic', expect: 'both' },
  { category: 'Fish', name: 'Herring', query: 'herring atlantic', expect: 'both' },
  // Eggs & dairy
  { category: 'Egg/Dairy', name: 'Egg (whole)', query: 'egg whole', expect: 'both' },
  { category: 'Egg/Dairy', name: 'Yogurt (plain, whole)', query: 'yogurt plain whole milk', expect: 'raw_only' },
  { category: 'Egg/Dairy', name: 'Cottage cheese', query: 'cottage cheese lowfat', expect: 'raw_only' },
  // Vegetables
  { category: 'Vegetable', name: 'Carrot', query: 'carrots', expect: 'both' },
  { category: 'Vegetable', name: 'Broccoli', query: 'broccoli', expect: 'both' },
  { category: 'Vegetable', name: 'Spinach', query: 'spinach', expect: 'both' },
  { category: 'Vegetable', name: 'Kale', query: 'kale', expect: 'both' },
  { category: 'Vegetable', name: 'Green beans', query: 'green beans snap', expect: 'both' },
  { category: 'Vegetable', name: 'Peas (green)', query: 'peas green', expect: 'both' },
  { category: 'Vegetable', name: 'Bell pepper', query: 'peppers sweet bell', expect: 'both' },
  { category: 'Vegetable', name: 'Pumpkin', query: 'pumpkin', expect: 'both' },
  { category: 'Vegetable', name: 'Zucchini', query: 'zucchini summer squash', expect: 'both' },
  { category: 'Vegetable', name: 'Cauliflower', query: 'cauliflower', expect: 'both' },
  { category: 'Vegetable', name: 'Cucumber', query: 'cucumber with peel', expect: 'raw_only' },
  // Fruits — no cooked variant expected
  { category: 'Fruit', name: 'Blueberries', query: 'blueberries', expect: 'raw_only' },
  { category: 'Fruit', name: 'Apple', query: 'apples raw', expect: 'raw_only' },
  { category: 'Fruit', name: 'Banana', query: 'bananas raw', expect: 'raw_only' },
  { category: 'Fruit', name: 'Watermelon', query: 'watermelon raw', expect: 'raw_only' },
  { category: 'Fruit', name: 'Strawberries', query: 'strawberries raw', expect: 'raw_only' },
  { category: 'Fruit', name: 'Cranberries', query: 'cranberries raw', expect: 'raw_only' },
  // Carbs / grains — cooked is the fed form
  { category: 'Grain', name: 'White rice', query: 'rice white', expect: 'both' },
  { category: 'Grain', name: 'Brown rice', query: 'rice brown', expect: 'both' },
  { category: 'Grain', name: 'Oatmeal', query: 'oats', expect: 'both' },
  { category: 'Grain', name: 'Quinoa', query: 'quinoa', expect: 'both' },
  { category: 'Grain', name: 'Sweet potato', query: 'sweet potato', expect: 'both' },
  // Legumes / pulses
  { category: 'Legume', name: 'Chickpeas (garbanzo)', query: 'chickpeas garbanzo', expect: 'both' },
  { category: 'Legume', name: 'Lentils', query: 'lentils', expect: 'both' },
  { category: 'Legume', name: 'Black beans', query: 'beans black mature seeds', expect: 'both' },
  // Fats & oils (coconut/flaxseed oil) are deliberately absent: like the
  // hand-curated supplements, they have no raw/cooked split to audit.
]

interface Result extends Staple {
  totalHits: number
  hasRaw: boolean
  hasCooked: boolean
  rawExample: string | null
  cookedExample: string | null
  gap: string | null
}

async function search(query: string): Promise<{ totalHits: number; descriptions: string[] }> {
  const url = `${USDA_BASE_URL}/foods/search?query=${encodeURIComponent(
    query
  )}&pageSize=25&dataType=Foundation,SR%20Legacy`
  const res = await fetch(url, { headers: { 'X-Api-Key': usdaKey! } })
  if (!res.ok) throw new Error(`USDA search failed for "${query}": ${res.status}`)
  const data = await res.json()
  return {
    totalHits: data.totalHits ?? 0,
    descriptions: (data.foods ?? []).map((f: { description: string }) => f.description),
  }
}

function evaluate(staple: Staple, descriptions: string[]) {
  let rawExample: string | null = null
  let cookedExample: string | null = null
  for (const d of descriptions) {
    const state = inferPreparationState(d)
    if (state === 'raw' && !rawExample) rawExample = d
    if (state === 'cooked' && !cookedExample) cookedExample = d
  }
  const hasRaw = !!rawExample
  const hasCooked = !!cookedExample

  let gap: string | null = null
  if (staple.expect === 'both') {
    if (!hasRaw && !hasCooked) gap = 'NO MATCH — no raw or cooked variant found'
    else if (!hasRaw) gap = 'missing RAW variant'
    else if (!hasCooked) gap = 'missing COOKED variant'
  } else if (staple.expect === 'raw_only' && !hasRaw && descriptions.length === 0) {
    gap = 'NO MATCH'
  } else if (staple.expect === 'cooked_only' && !hasCooked && !hasRaw && descriptions.length === 0) {
    gap = 'NO MATCH'
  }
  return { hasRaw, hasCooked, rawExample, cookedExample, gap }
}

async function main() {
  const results: Result[] = []
  for (const staple of STAPLES) {
    try {
      const { totalHits, descriptions } = await search(staple.query)
      const evald = evaluate(staple, descriptions)
      results.push({ ...staple, totalHits, ...evald })
      const flag = evald.gap ? `  ⚠️ ${evald.gap}` : ''
      console.error(
        `${staple.name.padEnd(24)} raw=${evald.hasRaw ? 'Y' : '-'} cooked=${evald.hasCooked ? 'Y' : '-'} hits=${totalHits}${flag}`
      )
      await new Promise(r => setTimeout(r, 120))
    } catch (err) {
      console.error(`ERROR ${staple.name}:`, err)
      results.push({
        ...staple,
        totalHits: 0,
        hasRaw: false,
        hasCooked: false,
        rawExample: null,
        cookedExample: null,
        gap: 'FETCH ERROR',
      })
    }
  }

  writeFileSync(
    'audits/usda-raw-cooked-gaps.json',
    JSON.stringify({ generated: new Date().toISOString().slice(0, 10), results }, null, 2)
  )

  const gaps = results.filter(r => r.gap)
  console.error(`\n${results.length} staples checked, ${gaps.length} gap(s).`)

  // Markdown table to stdout
  console.log('| Category | Staple | Expect | Raw in FDC | Cooked in FDC | Status |')
  console.log('|---|---|---|---|---|---|')
  for (const r of results) {
    const status = r.gap ? `⚠️ ${r.gap}` : '✅ ok'
    console.log(
      `| ${r.category} | ${r.name} | ${r.expect} | ${r.hasRaw ? 'Y' : '—'} | ${r.hasCooked ? 'Y' : '—'} | ${status} |`
    )
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
