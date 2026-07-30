// Shared ingredient resolution for bowl labels and manual search, per
// docs/BRANDED_INGREDIENTS_DESIGN.md §4: local foods table first (USDA/
// curated + previously cached OFF rows), then Open (Pet) Food Facts as a
// SUGGESTION — never an auto-commit. OFF rows only enter `foods` when the
// owner accepts a suggestion (cache-on-accept), so generic labels like
// "macaroni" can't pull crowd-sourced junk into the trusted table.

import { searchOFFByName, type OFFProductLike } from '@/lib/off-integration'
import type { Database } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Confidence floor below which a label stays unmatched.
 *
 * Re-fitted 2026-07-29 for the blended relevance score introduced in
 * migration 20260729000100. The old 0.3 was calibrated against the previous
 * scoring, which saturated at 1.00 for anything containing the query — under
 * that score a 0.3 floor rejected essentially nothing, so the bowl resolver
 * auto-matched the alphabetically-first row containing the label.
 *
 * The blended score spreads out, so the floor now does real work. Measured
 * across all 5,029 live rows (see scripts/023_search_relevance_check.ts):
 *
 *   labels that SHOULD resolve locally ....... 0.584 - 0.913
 *     ('white rice' 0.584 is the floor case; typos land ~0.64)
 *   labels that should NOT (branded/DTC) ..... 0.000 - 0.363
 *     ('greenies' -> "Beet greens, raw" 0.329 is the worst false positive)
 *
 * 0.5 sits mid-gap. Raising it past ~0.58 starts rejecting real matches;
 * lowering it below ~0.37 lets branded labels match whole foods by accident.
 */
export const MATCH_THRESHOLD = 0.5

/** How long an OFF suggestion lookup may take before we give up on it. */
const OFF_SUGGESTION_TIMEOUT_MS = 4000

export interface BrandedSuggestion {
  /** OFF product code (barcode) — the accept flow re-fetches by this */
  code: string
  name: string
  brand: string | null
  attribution: string | null
  kcal_per_100g: number
}

export interface ResolvedIngredient {
  ingredientId: string | null
  brandedSuggestion: BrandedSuggestion | null
}

/**
 * Resolve a food label against the local `foods` table. Returns null when
 * nothing safe clears the similarity floor — a toxic top hit is never
 * auto-matched (the owner can still pick it deliberately in the UI).
 */
export async function matchLocalIngredient(
  supabase: SupabaseClient<Database>,
  label: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc('fuzzy_search_foods', {
    search_query: label,
    match_limit: 1,
  })
  if (error || !data || data.length === 0) return null
  const top = data[0] as {
    id: string
    similarity?: number
    is_safe_for_dogs?: boolean
  }
  if (top.similarity != null && top.similarity < MATCH_THRESHOLD) return null
  if (top.is_safe_for_dogs === false) return null
  return top.id
}

/**
 * Look for a branded candidate on Open (Pet) Food Facts. Best-effort with a
 * hard timeout: a slow or down OFF must not stall bowl analysis. Only
 * candidates that are actually loggable (named + reporting kcal) qualify.
 */
export async function suggestBranded(
  label: string
): Promise<BrandedSuggestion | null> {
  try {
    const products = await Promise.race([
      searchOFFByName(label, 5),
      new Promise<OFFProductLike[]>(resolve =>
        setTimeout(() => resolve([]), OFF_SUGGESTION_TIMEOUT_MS)
      ),
    ])
    for (const product of products) {
      const kcal = product.nutriments?.['energy-kcal_100g']
      if (!product.product_name?.trim()) continue
      if (typeof kcal !== 'number' || !Number.isFinite(kcal)) continue
      return {
        code: product.code,
        name: product.product_name.trim(),
        brand: product.brands?.split(',')[0]?.trim() || null,
        attribution: product._attribution ?? null,
        kcal_per_100g: kcal,
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Full resolution chain: local match, else OFF suggestion. The suggestion is
 * surfaced to the owner for confirmation; nothing is written anywhere here.
 */
export async function resolveIngredient(
  supabase: SupabaseClient<Database>,
  label: string
): Promise<ResolvedIngredient> {
  const ingredientId = await matchLocalIngredient(supabase, label)
  if (ingredientId) return { ingredientId, brandedSuggestion: null }
  return { ingredientId: null, brandedSuggestion: await suggestBranded(label) }
}
