// Open Food Facts (OFF) integration — the branded-product counterpart to
// lib/usda-canine.ts, per docs/BRANDED_INGREDIENTS_DESIGN.md §9.
//
// OFF is crowd-sourced and macro-heavy: it reliably reports per-100g energy,
// protein, fat, carbs, fiber, sugars, and salt, and only rarely the
// canine-critical micros. Everything unreported maps to NULL, never 0
// ("missing ≠ zero", design §6) — branded rows are for calorie/macro logging
// and are excluded from micronutrient gap math (BRANDED_SOURCES in types).
//
// Licensing: OFF data is ODbL. Every row carries source='off' (isolable from
// any future export) and a source_attribution credit string (design §7).

import { checkDogSafety } from '@/lib/dog-toxic-foods'
import type { DataCompleteness } from '@/lib/types'

// Commercial pet foods mostly live on Open PET Food Facts, a sister database
// with an identical API and the same ODbL license; human-grade toppers (bone
// broth, plain yogurt brands, ...) live on the main Open Food Facts. Lookups
// try OPFF first (the likelier hit for this app), then OFF.
const OFF_HOSTS = [
  {
    base: 'https://world.openpetfoodfacts.org',
    attribution: 'Nutrition data © Open Pet Food Facts contributors, ODbL',
  },
  {
    base: 'https://world.openfoodfacts.org',
    attribution: 'Nutrition data © Open Food Facts contributors, ODbL',
  },
] as const

// OFF asks API consumers to identify themselves via User-Agent.
const OFF_USER_AGENT = 'PawPlate/1.0 (fresh-feeding dog nutrition tracker)'

/** The slice of an OFF product response the mapper consumes. */
export interface OFFProductLike {
  code: string
  product_name?: string
  brands?: string
  nutriments?: Record<string, number | string | undefined>
  /** Which database answered — set by the fetch helpers, drives attribution */
  _attribution?: string
}

/**
 * Fetch a product by EAN/UPC barcode, trying Open Pet Food Facts then Open
 * Food Facts. Returns null when neither has an entry (status 0) or requests
 * fail — barcode misses are an expected outcome, not an error.
 */
export async function fetchOFFByBarcode(
  barcode: string
): Promise<OFFProductLike | null> {
  for (const host of OFF_HOSTS) {
    try {
      const response = await fetch(
        `${host.base}/api/v2/product/${encodeURIComponent(barcode)}.json`,
        { headers: { 'User-Agent': OFF_USER_AGENT } }
      )
      if (!response.ok) continue
      const data = await response.json()
      if (data.status === 1 && data.product) {
        return { ...(data.product as OFFProductLike), _attribution: host.attribution }
      }
    } catch {
      // network hiccup on one host shouldn't kill the fallback
    }
  }
  return null
}

/**
 * Name search for branded products across both databases (OPFF results
 * first). Lower-confidence than barcode lookup — callers should treat
 * results as candidates to confirm, not matches.
 */
export async function searchOFFByName(
  name: string,
  limit = 10
): Promise<OFFProductLike[]> {
  const params = new URLSearchParams({
    search_terms: name,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: String(limit),
  })
  const results: OFFProductLike[] = []
  for (const host of OFF_HOSTS) {
    if (results.length >= limit) break
    try {
      const response = await fetch(`${host.base}/cgi/search.pl?${params}`, {
        headers: { 'User-Agent': OFF_USER_AGENT },
      })
      if (!response.ok) continue
      const data = await response.json()
      for (const product of (data.products ?? []) as OFFProductLike[]) {
        results.push({ ...product, _attribution: host.attribution })
      }
    } catch {
      // ignore and try the other host
    }
  }
  return results.slice(0, limit)
}

/** Read a per-100g nutriment value; undefined/non-numeric → null. */
function per100g(
  nutriments: Record<string, number | string | undefined>,
  key: string
): number | null {
  const value = nutriments[`${key}_100g`]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Convert an OFF product into a `foods` (Ingredient) row, per 100 g.
 *
 * Mirrors convertUSDAToIngredient() but with the OFF response shape and the
 * branded-data rules: unreported nutrients stay null (the schema dropped
 * DEFAULT 0 in migration 20260709000000), completeness is macro-based, and
 * rows are never is_verified.
 *
 * Returns null when OFF reports no energy value: calories_per_serving is
 * NOT NULL in the schema, and a branded row exists precisely for
 * calorie/macro logging — without kcal it has no usable purpose.
 */
export function convertOFFToIngredient(product: OFFProductLike) {
  const nutriments = product.nutriments ?? {}
  const name = product.product_name?.trim() || `OFF product ${product.code}`
  const safety = checkDogSafety(name)

  const calories = per100g(nutriments, 'energy-kcal')
  if (calories === null) return null
  const protein = per100g(nutriments, 'proteins')
  const fat = per100g(nutriments, 'fat')
  const carbs = per100g(nutriments, 'carbohydrates')

  // OFF reports salt in grams; sodium_mg = salt_g * 1000 / 2.5. Prefer a
  // directly-reported sodium value (also grams in OFF) when present.
  const sodiumG = per100g(nutriments, 'sodium')
  const saltG = per100g(nutriments, 'salt')
  const sodiumMg =
    sodiumG !== null ? sodiumG * 1000 : saltG !== null ? (saltG * 1000) / 2.5 : null

  const hasAllMacros = protein !== null && fat !== null && carbs !== null
  const completeness: DataCompleteness = hasAllMacros ? 'macros_only' : 'sparse'

  return {
    name,
    brand: product.brands?.split(',')[0]?.trim() || null,
    serving_size: 100,
    serving_unit: 'g',
    calories_per_serving: calories,
    protein_g: protein,
    fat_g: fat,
    carbs_g: carbs,
    fiber_g: per100g(nutriments, 'fiber'),
    sugar_g: per100g(nutriments, 'sugars'),
    sodium_mg: sodiumMg,
    calcium_mg: mgFromG(per100g(nutriments, 'calcium')),
    iron_mg: mgFromG(per100g(nutriments, 'iron')),
    potassium_mg: mgFromG(per100g(nutriments, 'potassium')),
    is_safe_for_dogs: safety.isSafe,
    toxicity_note: safety.note,
    preparation_state: null,
    is_verified: false,
    source: 'off' as const,
    barcode: product.code,
    external_id: product.code,
    source_attribution:
      product._attribution ?? OFF_HOSTS[1].attribution,
    is_complete_food: false,
    data_completeness: completeness,
  }
}

/** OFF reports minerals in grams per 100g; convert to mg, preserving null. */
function mgFromG(grams: number | null): number | null {
  return grams === null ? null : grams * 1000
}
