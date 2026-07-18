/**
 * Import verified USDA raw entries for staple ingredients that only existed
 * as sparse, hand-curated (`is_verified: false`) rows in `foods`. Found by
 * the 2026-07-08 nutrient-coverage audit: 8 curated entries had incomplete
 * profiles despite a real Foundation/SR Legacy raw analog existing.
 *
 * These are inserted as NEW rows (not replacing the curated ones — existing
 * meal_items may reference them) so the verified USDA data becomes available
 * for meal-building and search alongside the legacy hand-entered rows.
 * Idempotent — dedupes on fdc_id like the other import scripts.
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/018_import_raw_counterparts.ts
 */

import { createClient } from '@supabase/supabase-js'
import { storePayload } from '../lib/source-payloads'
import { convertUSDAToIngredient, type USDAFoodLike } from '../lib/usda-canine'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const usdaKey = process.env.USDA_API_KEY || process.env.NEXT_PUBLIC_USDA_API_KEY

if (!url || !serviceKey || !usdaKey) {
  console.error('Missing env. Run: set -a && source .env.local && set +a  first.')
  process.exit(1)
}

const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1'
const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Chosen to replace: beef kidney raw, ground beef 90% raw, chicken breast/
// thigh raw, lamb ground raw, pork tenderloin raw, turkey ground 93% raw —
// the 7 (of 8) unverified curated entries with a real FDC raw analog. Kelp
// powder has no FDC entry (supplement, not a whole food) — left as-is.
const FDC_IDS = [
  169449, // Beef, variety meats and by-products, kidneys, raw
  174030, // Beef, ground, 90% lean meat / 10% fat, raw
  171077, // Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw
  173627, // Chicken, broilers or fryers, dark meat, thigh, meat only, raw
  174370, // Lamb, ground, raw
  168249, // Pork, fresh, loin, tenderloin, separable lean only, raw
  172850, // Turkey, ground, 93% lean, 7% fat, raw
]

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

  const { data: inserted, error } = await supabase
    .from('foods')
    .insert(row)
    .select('id')
    .single()
  await storePayload(supabase, {
    source: 'usda',
    kind: 'detail',
    externalId: fdcId,
    payload: detail,
    foodId: inserted?.id ?? null,
  })
  if (error) return `FAILED: ${error.message}`
  return `imported [${row.preparation_state ?? 'unknown'}] verified=${row.is_verified}`
}

async function main() {
  let imported = 0
  for (const fdcId of FDC_IDS) {
    const result = await importFood(fdcId)
    if (result.startsWith('imported')) imported++
    console.log(`${result}  ${fdcId}`)
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  console.log(`\nDone: ${imported} new ingredients imported.`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
