/**
 * Pin the USDA staple imports that previously existed only as one-off live
 * runs, plus the two legumes the 2026-07-10 coverage review found were never
 * imported at all (chickpeas, lentils — both confirmed available raw+cooked
 * in FDC by scripts/019_audit_raw_cooked_gaps.ts).
 *
 * scripts/import-cooked-ingredients.ts is the DISCOVERY script (fuzzy FDC
 * search + regex match — results depend on live search ranking); this file
 * is the PINNED REPRODUCTION: the exact fdc_ids that are live today, so a
 * fresh database re-seeds to the same state without depending on FDC search
 * behavior. Companion to scripts/018_import_raw_counterparts.ts (raw pins).
 *
 * Idempotent — dedupes on fdc_id; safe to re-run against a populated DB.
 * Raw detail payloads are archived to source_payloads on every fetch.
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/020_seed_staple_gaps.ts
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

const FDC_IDS = [
  // -- Cooked variants originally imported live by import-cooked-ingredients.ts
  171477, // Chicken, broilers or fryers, breast, meat only, cooked, roasted
  171478, // Chicken, broilers or fryers, breast, meat only, cooked, stewed
  172388, // Chicken, broilers or fryers, thigh, meat only, cooked, roasted
  172389, // Chicken, broilers or fryers, thigh, meat only, cooked, stewed
  171061, // Chicken, liver, all classes, cooked, simmered
  171795, // Beef, ground, 90% lean meat / 10% fat, loaf, cooked, baked
  174031, // Beef, ground, 90% lean meat / 10% fat, patty, cooked, broiled
  171506, // Turkey, Ground, cooked
  173424, // Egg, whole, cooked, hard-boiled
  172185, // Egg, whole, cooked, omelet
  175168, // Fish, salmon, Atlantic, farmed, cooked, dry heat
  170134, // Sweet potato, cooked, baked in skin, flesh, with salt
  // -- Legume staples never imported before (raw + cooked, unsalted for dogs)
  173756, // Chickpeas (garbanzo beans, bengal gram), mature seeds, raw
  173757, // Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt
  172420, // Lentils, raw
  172421, // Lentils, mature seeds, cooked, boiled, without salt
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
