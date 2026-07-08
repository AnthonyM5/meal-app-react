/**
 * Backfill the amino-acid/B-vitamin columns (added in migration
 * 20260708000000) onto ingredients already imported from USDA. Re-fetches
 * format=full for each fdc_id already in `foods` and re-derives the full
 * nutrient set via the updated extractor, then UPDATEs just the new columns
 * plus is_verified (the sparse-profile threshold changed too).
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/017_backfill_amino_and_b_vitamins.ts
 */

import { createClient } from '@supabase/supabase-js'
import {
  convertUSDAToIngredient,
  type USDAFoodLike,
} from '../lib/usda-canine'

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

async function main() {
  const { data: rows, error } = await supabase
    .from('foods')
    .select('id, fdc_id, name')
    .not('fdc_id', 'is', null)

  if (error) throw error
  console.log(`Found ${rows?.length ?? 0} USDA-sourced ingredients to backfill.`)

  for (const row of rows ?? []) {
    const detailResponse = await fetch(
      `${USDA_BASE_URL}/food/${row.fdc_id}?format=full`,
      { headers: { 'X-Api-Key': usdaKey! } }
    )
    if (!detailResponse.ok) {
      console.log(`SKIP ${row.name} (fdc_id ${row.fdc_id}): fetch ${detailResponse.status}`)
      continue
    }
    const detail = (await detailResponse.json()) as USDAFoodLike
    const full = convertUSDAToIngredient(detail)

    const { error: updateError } = await supabase
      .from('foods')
      .update({
        threonine_mg: full.threonine_mg,
        isoleucine_mg: full.isoleucine_mg,
        leucine_mg: full.leucine_mg,
        valine_mg: full.valine_mg,
        arginine_mg: full.arginine_mg,
        histidine_mg: full.histidine_mg,
        phenylalanine_tyrosine_mg: full.phenylalanine_tyrosine_mg,
        thiamin_mg: full.thiamin_mg,
        riboflavin_mg: full.riboflavin_mg,
        niacin_mg: full.niacin_mg,
        pantothenic_acid_mg: full.pantothenic_acid_mg,
        vitamin_b6_mg: full.vitamin_b6_mg,
        is_verified: full.is_verified,
      })
      .eq('id', row.id)

    if (updateError) {
      console.log(`FAILED ${row.name}: ${updateError.message}`)
    } else {
      console.log(`updated  ${row.name}  (fdc_id ${row.fdc_id})`)
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  console.log('\nBackfill done.')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
