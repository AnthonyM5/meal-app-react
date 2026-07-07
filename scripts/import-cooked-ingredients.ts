/**
 * Import cooked USDA variants of the common fresh-feeding proteins so raw
 * and cooked entries coexist in `foods` (values are as-fed; see
 * scripts/014_add_preparation_state.sql).
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/import-cooked-ingredients.ts
 *
 * Idempotent: dedupes on fdc_id like the /api/ingredients/import route.
 */

import { createClient } from '@supabase/supabase-js'
import { convertUSDAToIngredient, type USDAFoodLike } from '../lib/usda-canine'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const usdaKey =
  process.env.USDA_API_KEY || process.env.NEXT_PUBLIC_USDA_API_KEY

if (!url || !serviceKey || !usdaKey) {
  console.error(
    'Missing env. Run: set -a && source .env.local && set +a  first.'
  )
  process.exit(1)
}

const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1'
const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Plain home preparations only — skip restaurant/breaded/fried/canned
// entries, which carry added oils and sodium irrelevant to fresh feeding.
const EXCLUDE = /fried|breaded|battered|fast food|restaurant|canned|luncheon|sausage|nugget|patty, frozen/i

interface Target {
  query: string
  /** description must match to be imported */
  match: RegExp
  limit: number
}

const TARGETS: Target[] = [
  { query: 'chicken broilers breast meat only cooked', match: /breast, meat only, cooked/i, limit: 2 },
  { query: 'chicken broilers thigh meat only cooked', match: /thigh, meat only, cooked/i, limit: 2 },
  { query: 'chicken liver cooked simmered', match: /liver.*cooked/i, limit: 1 },
  { query: 'beef ground 90% lean cooked', match: /ground, 90%.*cooked/i, limit: 2 },
  { query: 'turkey ground cooked', match: /turkey, ground.*cooked/i, limit: 2 },
  { query: 'egg whole cooked hard-boiled', match: /egg, whole, cooked/i, limit: 2 },
  { query: 'salmon atlantic farmed cooked', match: /salmon, atlantic.*cooked/i, limit: 1 },
  { query: 'sweet potato cooked baked in skin', match: /sweet potato, cooked/i, limit: 1 },
]

async function searchUSDA(query: string): Promise<USDAFoodLike[]> {
  const response = await fetch(
    `${USDA_BASE_URL}/foods/search?query=${encodeURIComponent(
      query
    )}&pageSize=15&dataType=Foundation,SR%20Legacy`,
    { headers: { 'X-Api-Key': usdaKey! } }
  )
  if (!response.ok) throw new Error(`USDA search failed: ${response.status}`)
  const data = await response.json()
  return data.foods || []
}

async function importFood(fdcId: number): Promise<string> {
  const { data: existing } = await supabase
    .from('foods')
    .select('id')
    .eq('fdc_id', fdcId)
    .maybeSingle()
  if (existing) return 'skipped (already imported)'

  const detailResponse = await fetch(
    `${USDA_BASE_URL}/food/${fdcId}?format=full`,
    { headers: { 'X-Api-Key': usdaKey! } }
  )
  if (!detailResponse.ok) return `skipped (detail fetch ${detailResponse.status})`

  const detail = (await detailResponse.json()) as USDAFoodLike
  const row = convertUSDAToIngredient(detail)

  const { error } = await supabase.from('foods').insert(row)
  if (error) return `FAILED: ${error.message}`
  return `imported [${row.preparation_state ?? 'unknown'}] verified=${row.is_verified}`
}

async function main() {
  let imported = 0
  for (const target of TARGETS) {
    const foods = await searchUSDA(target.query)
    const picks = foods
      .filter(
        food =>
          target.match.test(food.description) &&
          !EXCLUDE.test(food.description)
      )
      .slice(0, target.limit)

    if (picks.length === 0) {
      console.log(`NO MATCH  "${target.query}"`)
      continue
    }
    for (const food of picks) {
      const result = await importFood(food.fdcId)
      if (result.startsWith('imported')) imported++
      console.log(`${result}  ${food.fdcId}  ${food.description}`)
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  console.log(`\nDone: ${imported} new ingredients imported.`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
