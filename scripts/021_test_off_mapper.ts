/**
 * Manual smoke test for the Open Food Facts mapper (lib/off-integration.ts).
 * Fetches a product by barcode, archives the raw response to source_payloads,
 * and prints the converted `foods` row — WITHOUT inserting it, unless the
 * explicit --insert flag is passed.
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/021_test_off_mapper.ts <barcode> [--insert]
 *
 * Example barcodes to try: any branded dog food/treat UPC from a package.
 */

import { createClient } from '@supabase/supabase-js'
import { convertOFFToIngredient, fetchOFFByBarcode } from '../lib/off-integration'
import { storePayload } from '../lib/source-payloads'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing env. Run: set -a && source .env.local && set +a  first.')
  process.exit(1)
}

const barcode = process.argv[2]
const doInsert = process.argv.includes('--insert')

if (!barcode || barcode.startsWith('--')) {
  console.error('Usage: npx tsx scripts/021_test_off_mapper.ts <barcode> [--insert]')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const product = await fetchOFFByBarcode(barcode)
  if (!product) {
    console.log(`No OFF entry for barcode ${barcode} (miss — expected for DTC/US-niche products).`)
    return
  }

  await storePayload(supabase, {
    source: 'off',
    kind: 'detail',
    externalId: barcode,
    payload: product,
  })

  const row = convertOFFToIngredient(product)
  if (!row) {
    console.log(
      `OFF has "${product.product_name ?? product.code}" but reports no energy value — not convertible (payload archived).`
    )
    return
  }

  console.log(JSON.stringify(row, null, 2))

  if (!doInsert) {
    console.log('\nDry run (no insert). Pass --insert to write this row to foods.')
    return
  }

  const { data: existing } = await supabase
    .from('foods')
    .select('id')
    .eq('barcode', barcode)
    .maybeSingle()
  if (existing) {
    console.log(`\nSkipped insert: barcode ${barcode} already in foods (${existing.id}).`)
    return
  }

  const { data: inserted, error } = await supabase
    .from('foods')
    .insert(row)
    .select('id')
    .single()
  if (error) {
    console.error('\nInsert FAILED:', error.message)
    process.exit(1)
  }
  await storePayload(supabase, {
    source: 'off',
    kind: 'detail',
    externalId: barcode,
    payload: product,
    foodId: inserted.id,
  })
  console.log(`\nInserted foods row ${inserted.id} (source=off, unverified).`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
