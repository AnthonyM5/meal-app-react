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
 * A variant is materially different if it moves calories by more than this
 * fraction. 20% of a meal's energy is well past rounding — for a 150 g serving
 * of ground beef the group spans 182-498 kcal, a 2.7x swing.
 */
export const AMBIGUOUS_KCAL_RATIO = 0.2

/**
 * ...or moves fat by more than this many grams per 100 g. Fat matters
 * independently of calories for dogs: 3 g vs 30 g per 100 g is the difference
 * between a routine meal and a pancreatitis risk in a susceptible dog.
 */
export const AMBIGUOUS_FAT_DELTA_G = 5

/**
 * The canonical group a matched ingredient belongs to, plus whether its
 * variants disagree enough that the owner must choose explicitly.
 *
 * The vision model emits "ground beef" — it cannot see lean/fat ratio, and
 * nothing downstream can infer it. Before this, `matchLocalIngredient` took
 * the single top-scoring row and its ratio silently became the bowl's
 * nutrition. That is a guess presented as a measurement, so the flow now
 * refuses to proceed until the owner picks.
 */
export interface CanonicalMatch {
  canonicalId: string
  displayName: string
  variantCount: number
  /** Owner must explicitly choose a variant before the bowl can be logged */
  requiresChoice: boolean
  /** [min, max] kcal per 100 g across the group — the UI explains the spread */
  kcalRange: [number, number] | null
  /** [min, max] fat g per 100 g across the group */
  fatRange: [number, number] | null
}

export interface MatchedIngredient {
  ingredientId: string | null
  canonical: CanonicalMatch | null
}

function range(values: number[]): [number, number] | null {
  return values.length > 0 ? [Math.min(...values), Math.max(...values)] : null
}

/**
 * Resolve a label AND report the canonical group it landed in, so the
 * confirmation UI can require an explicit variant choice when the group's
 * members disagree materially on calories or fat.
 *
 * Single-variant groups (55% of the catalogue) never require a choice — there
 * is nothing to choose. Of the multi-variant groups, ~73% are flagged.
 */
export async function matchIngredientWithCanonical(
  supabase: SupabaseClient<Database>,
  label: string
): Promise<MatchedIngredient> {
  const ingredientId = await matchLocalIngredient(supabase, label)
  if (!ingredientId) return { ingredientId: null, canonical: null }

  const { data: matched, error: matchedError } = await supabase
    .from('foods')
    .select('canonical_id')
    .eq('id', ingredientId)
    .single()
  // A row with no canonical_id is legitimate (branded/manual rows are never
  // parsed into the canonical layer) — resolve it without a choice gate.
  if (matchedError || !matched?.canonical_id) {
    return { ingredientId, canonical: null }
  }

  const [{ data: group }, { data: variants }] = await Promise.all([
    supabase
      .from('canonical_ingredients')
      .select('id,display_name,variant_count')
      .eq('id', matched.canonical_id)
      .single(),
    supabase
      .from('foods')
      .select('calories_per_serving,fat_g')
      .eq('canonical_id', matched.canonical_id)
      .eq('is_active', true),
  ])

  if (!group || !variants || variants.length <= 1) {
    return { ingredientId, canonical: null }
  }

  const kcalRange = range(
    variants
      .map(v => Number(v.calories_per_serving))
      .filter(n => Number.isFinite(n) && n > 0)
  )
  const fatRange = range(
    variants.map(v => Number(v.fat_g)).filter(n => Number.isFinite(n))
  )

  const kcalAmbiguous =
    kcalRange !== null && (kcalRange[1] - kcalRange[0]) / kcalRange[0] > AMBIGUOUS_KCAL_RATIO
  const fatAmbiguous =
    fatRange !== null && fatRange[1] - fatRange[0] > AMBIGUOUS_FAT_DELTA_G

  return {
    ingredientId,
    canonical: {
      canonicalId: group.id as string,
      displayName: group.display_name as string,
      variantCount: variants.length,
      requiresChoice: kcalAmbiguous || fatAmbiguous,
      kcalRange,
      fatRange,
    },
  }
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
