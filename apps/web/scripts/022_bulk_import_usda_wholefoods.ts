/**
 * Filtered bulk import of USDA whole foods (Foundation + SR Legacy) into
 * `foods`, replacing the old query-at-a-time curation as the coverage
 * strategy. Two-layer safety model:
 *
 *   1. CATEGORY WHITELIST (primary). Only dog-relevant FDC food categories
 *      are fetched at all. This closes the composite-name hole that the
 *      name-based checker can't see ("beef stroganoff mix" names no toxic
 *      ingredient) by never importing prepared-dish/snack/beverage
 *      categories in the first place. Applies to Foundation too — it
 *      carries a few processed categories (sausages, baked, restaurant).
 *   2. checkDogSafety (secondary, inside convertUSDAToIngredient). Whitelisted
 *      categories still contain toxic whole foods (onion, garlic, grapes are
 *      "Vegetables"/"Fruits"). Those rows ARE imported, flagged
 *      is_safe_for_dogs=false — preserved for the safety layer, excluded
 *      from bowl auto-resolution (see normalizeLabel).
 *
 * Idempotent: already-imported fdc_ids are skipped (re-run fetches nothing);
 * writes are upserts on fdc_id. Raw search pages and per-food detail payloads
 * are archived to source_payloads so future re-derivations never re-fetch.
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/022_bulk_import_usda_wholefoods.ts --dry-run
 *   npx tsx scripts/022_bulk_import_usda_wholefoods.ts --category="Cereal Grains and Pasta"
 *   npx tsx scripts/022_bulk_import_usda_wholefoods.ts
 *
 * Flags:
 *   --dry-run             enumerate + filter only; print category counts and
 *                         sample rows, write nothing
 *   --category="<name>"   restrict the import to one whitelisted category
 *   --refresh             re-fetch and upsert rows whose fdc_id already exists
 *                         (default: skip them)
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
const PAGE_SIZE = 200
const DETAIL_BATCH_SIZE = 20 // FDC POST /foods maximum
const REQUEST_DELAY_MS = 500 // stay well inside the 1000 req/hr key limit
// FDC full-payload batch fetches are slow (~25s round trip); run a few in
// flight at once. ~250 total requests even at this width stays far under
// the 1000 req/hr key limit.
const CONCURRENT_BATCHES = 4

const DRY_RUN = process.argv.includes('--dry-run')
const REFRESH = process.argv.includes('--refresh')
const ONLY_CATEGORY = process.argv
  .find(a => a.startsWith('--category='))
  ?.split('=')[1]
  ?.replace(/^"|"$/g, '')

/**
 * SR Legacy categories a fresh-fed dog bowl can actually contain. Everything
 * else (Soups/Sauces, Baked Products, Sweets, Snacks, Fast Foods, Beverages,
 * Meals/Entrees, Sausages and Luncheon Meats, Baby Foods, Breakfast Cereals,
 * Spices, Restaurant Foods, American Indian/Alaska Native Foods, ...) is
 * never fetched.
 */
const CATEGORY_WHITELIST = new Set([
  'Dairy and Egg Products',
  'Fats and Oils',
  'Poultry Products',
  'Pork Products',
  'Beef Products',
  'Lamb, Veal, and Game Products',
  'Finfish and Shellfish Products',
  'Fruits and Fruit Juices',
  'Vegetables and Vegetable Products',
  'Legumes and Legume Products',
  'Nut and Seed Products',
  'Cereal Grains and Pasta',
])

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

interface SearchHit {
  fdcId: number
  description: string
  foodCategory?: string
  dataType: string
}

async function enumerateDataType(dataType: string): Promise<SearchHit[]> {
  const hits: SearchHit[] = []
  let page = 1
  let totalPages = 1
  while (page <= totalPages) {
    const params = new URLSearchParams({
      query: '*',
      pageSize: String(PAGE_SIZE),
      pageNumber: String(page),
      dataType,
    })
    const response = await fetch(`${USDA_BASE_URL}/foods/search?${params}`, {
      headers: { 'X-Api-Key': usdaKey! },
    })
    if (!response.ok) {
      throw new Error(`FDC search ${dataType} p${page}: ${response.status}`)
    }
    const data = await response.json()
    totalPages = data.totalPages ?? 1
    if (!DRY_RUN) {
      await storePayload(supabase, {
        source: 'usda',
        kind: 'search',
        externalId: `bulk:${dataType}:page${page}`,
        payload: data,
      })
    }
    for (const f of data.foods ?? []) {
      hits.push({
        fdcId: f.fdcId,
        description: f.description,
        foodCategory: f.foodCategory,
        dataType,
      })
    }
    console.error(`  ${dataType} page ${page}/${totalPages} (${hits.length} so far)`)
    page++
    await sleep(REQUEST_DELAY_MS)
  }
  return hits
}

async function fetchDetailBatch(fdcIds: number[]): Promise<USDAFoodLike[]> {
  const response = await fetch(`${USDA_BASE_URL}/foods`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': usdaKey! },
    // no `nutrients` filter: archive the complete payload
    body: JSON.stringify({ fdcIds, format: 'full' }),
  })
  if (!response.ok) {
    throw new Error(`FDC batch fetch: ${response.status} ${await response.text()}`)
  }
  return response.json()
}

async function main() {
  // 1. Enumerate both whole-food data types
  console.error('Enumerating FDC corpus...')
  const all = [
    ...(await enumerateDataType('Foundation')),
    ...(await enumerateDataType('SR Legacy')),
  ]

  // 2. Category filter — applied to BOTH data types. (Foundation is mostly
  // whole foods but does carry a few processed categories: Sausages and
  // Luncheon Meats, Baked Products, Restaurant Foods, Sweets, Beverages.)
  const survivors = all.filter(
    h => h.foodCategory && CATEGORY_WHITELIST.has(h.foodCategory)
  )
  const filtered = ONLY_CATEGORY
    ? survivors.filter(h => h.foodCategory === ONLY_CATEGORY)
    : survivors

  const byCategory = new Map<string, number>()
  for (const h of filtered) {
    const key = `${h.foodCategory ?? '(none)'} [${h.dataType}]`
    byCategory.set(key, (byCategory.get(key) ?? 0) + 1)
  }
  console.error(
    `\nCorpus: ${all.length} | after whitelist: ${survivors.length}` +
      (ONLY_CATEGORY ? ` | in --category: ${filtered.length}` : '')
  )
  for (const [cat, n] of [...byCategory.entries()].sort((a, b) => b[1] - a[1])) {
    console.error(`  ${String(n).padStart(5)}  ${cat}`)
  }

  if (DRY_RUN) {
    console.error('\nSample rows:')
    for (const h of filtered.slice(0, 15)) {
      console.error(`  ${h.fdcId}  ${h.description}`)
    }
    console.error('\nDry run — nothing written.')
    return
  }

  // 3. Skip fdc_ids already in foods (unless --refresh)
  const { data: existingRows, error: existingError } = await supabase
    .from('foods')
    .select('fdc_id')
    .not('fdc_id', 'is', null)
  if (existingError) throw existingError
  const existing = new Set((existingRows ?? []).map(r => r.fdc_id as number))
  const toFetch = REFRESH
    ? filtered
    : filtered.filter(h => !existing.has(h.fdcId))
  console.error(
    `\nExisting fdc_ids: ${existing.size} | to fetch: ${toFetch.length}`
  )

  // 4. Batch-fetch details, archive payloads, convert, upsert. Batches run
  // CONCURRENT_BATCHES at a time — distinct fdc_ids per batch, and both
  // upserts are conflict-keyed, so concurrent groups can't collide.
  let imported = 0
  let flaggedUnsafe = 0
  let failed = 0
  let done = 0

  async function processBatch(batch: SearchHit[]): Promise<void> {
    let details: USDAFoodLike[]
    try {
      details = await fetchDetailBatch(batch.map(h => h.fdcId))
    } catch (err) {
      console.error(`Batch fetch failed:`, err)
      failed += batch.length
      done += batch.length
      return
    }

    const rows = details.map(convertUSDAToIngredient)
    const { error: upsertError } = await supabase
      .from('foods')
      .upsert(rows, { onConflict: 'fdc_id' })
    if (upsertError) {
      console.error(`Upsert failed: ${upsertError.message}`)
      failed += rows.length
    } else {
      imported += rows.length
      flaggedUnsafe += rows.filter(r => !r.is_safe_for_dogs).length
    }

    // Archive raw detail payloads (link food_id afterwards in one pass)
    const { error: payloadError } = await supabase.from('source_payloads').upsert(
      details.map(d => ({
        source: 'usda',
        kind: 'detail',
        external_id: String(d.fdcId),
        payload: d as unknown as Record<string, unknown>,
        fetched_at: new Date().toISOString(),
      })),
      { onConflict: 'source,kind,external_id' }
    )
    if (payloadError) {
      console.error(`Payload archive failed: ${payloadError.message}`)
    }
    done += batch.length
    console.error(
      `  ${done}/${toFetch.length} imported=${imported} unsafe=${flaggedUnsafe} failed=${failed}`
    )
  }

  const batches: SearchHit[][] = []
  for (let i = 0; i < toFetch.length; i += DETAIL_BATCH_SIZE) {
    batches.push(toFetch.slice(i, i + DETAIL_BATCH_SIZE))
  }
  for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
    await Promise.all(batches.slice(i, i + CONCURRENT_BATCHES).map(processBatch))
    await sleep(REQUEST_DELAY_MS)
  }

  // 5. Link archived detail payloads to their foods rows
  const { error: linkError } = await supabase.rpc('link_source_payload_foods')
  if (linkError) {
    // RPC may not exist — fall back to a direct join update via SQL is not
    // available through supabase-js; log and move on (food_id is a
    // convenience link, external_id ↔ fdc_id already joins them).
    console.error(`(payload food_id linking skipped: ${linkError.message})`)
  }

  console.error(
    `\nDone. imported=${imported} (unsafe-flagged=${flaggedUnsafe}) failed=${failed}`
  )
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
