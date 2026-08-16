// Shared ingredient resolution for bowl labels and manual search, per
// docs/BRANDED_INGREDIENTS_DESIGN.md §4: local foods table first (USDA/
// curated + previously cached OFF rows), then Open (Pet) Food Facts as a
// SUGGESTION — never an auto-commit. OFF rows only enter `foods` when the
// owner accepts a suggestion (cache-on-accept), so generic labels like
// "macaroni" can't pull crowd-sourced junk into the trusted table.

import { parseFoodName } from '@/lib/food-name-parser'
import { searchOFFByName, type OFFProductLike } from '@/lib/off-integration'
import { per100g, type CanonicalMatch, type Database } from '@/lib/types'
import { isNutritionallyUsable } from '@/lib/usda-canine'
import type { SupabaseClient } from '@supabase/supabase-js'

// Shared with the confirmation UI and the mobile client — the single
// definition lives in @pawplate/core.
export type { CanonicalMatch }

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

/**
 * How many candidates the local matcher inspects before giving up.
 *
 * Was 1. Raising it does NOT change ranking — the loop still takes the first
 * row that clears every bar — it only gives the matcher somewhere to go when
 * the best-named row carries broken nutrition, instead of returning it anyway.
 *
 * Note this is NOT a way past an unsafe top hit. A toxic row that outranks
 * everything safe aborts the match entirely rather than falling through to
 * the next candidate; see matchLocalIngredient.
 */
const CANDIDATE_LIMIT = 10

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
 * A preparation state the pipeline has actually OBSERVED. `null` and
 * `undefined` both mean "not observed" — they are never a value to act on.
 */
export type PreparationState = 'raw' | 'cooked' | null | undefined

export interface MatchedIngredient {
  ingredientId: string | null
  canonical: CanonicalMatch | null
}

function range(values: number[]): [number, number] | null {
  return values.length > 0 ? [Math.min(...values), Math.max(...values)] : null
}

/**
 * Within one canonical group, the least-qualified variant matching an
 * OBSERVED preparation state.
 *
 * Flat search cannot reach these. "chickpeas" scores its cooked rows at 0.419
 * — below MATCH_THRESHOLD — because USDA spells them
 * "Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled,
 * without salt" and the extra segments dilute similarity, while the terse
 * "Chickpeas, ..., dry" row wins at 0.753. Lowering the floor to reach them is
 * not an option: it exists to stop branded junk auto-matching.
 *
 * The canonical group is the right candidate set instead. Membership already
 * asserts "this is the same food", so a same-prep sibling needs no similarity
 * score to justify it — that judgement was made when the group was built.
 *
 * Ordering is by PARSER RESIDUAL first, then name length. Residual holds the
 * segments the parser could not classify, which is exactly where a
 * different-food-in-the-same-group hides: "Broccoli, chinese, cooked" carries
 * residual ['chinese'] and over-merged into `broccoli` because the parser
 * drops unknown modifiers. On name length alone it is the SHORTEST cooked
 * broccoli row, so a length-only rule served gai lan for broccoli. Residual
 * count catches that without needing the merge itself fixed.
 */
export function pickPrepVariant<
  T extends { id: string; name: string; preparation_state: string | null },
>(variants: T[], prep: 'raw' | 'cooked'): T | null {
  const matching = variants
    .filter(v => v.preparation_state === prep)
    .map(v => ({ v, residual: parseFoodName(v.name).attrs.residual.length }))
    .sort(
      (a, b) =>
        a.residual - b.residual ||
        a.v.name.length - b.v.name.length ||
        a.v.name.localeCompare(b.v.name)
    )
  return matching[0]?.v ?? null
}

/**
 * Resolve a label AND report the canonical group it landed in, so the
 * confirmation UI can require an explicit variant choice when the group's
 * members disagree materially on calories or fat.
 *
 * Single-variant groups (55% of the catalogue) never require a choice — there
 * is nothing to choose.
 *
 * PREPARATION STATE IS NEVER DEFAULTED. This function used to narrow the
 * ambiguity spread to variants sharing the matched row's preparation_state,
 * on the reasoning that raw vs cooked differ per 100 g by water loss and
 * flagging it would gate ~73% of multi-variant groups. That reasoning is only
 * sound if the preparation state is KNOWN — and nothing ever established it.
 * The vision model was not asked, so "raw" arrived purely as an artifact of
 * flat search preferring short names ("Carrots, raw" beats "Carrots, cooked,
 * boiled, drained, without salt" on brevity alone). Narrowing by an assumed
 * value filtered away the very question that needed asking, and the owner
 * silently logged raw carrots for a cooked meal.
 *
 * Now: `prep` is the model's observation, and null means unknown. When it is
 * unknown AND the group actually offers more than one preparation state, the
 * owner is asked. When it is known, it narrows as before — that is evidence,
 * not a default.
 *
 * All values are normalized to per-100 g via per100g() rather than read raw —
 * the "serving_size is always 100" convention is enforced here, not assumed.
 */
export async function matchIngredientWithCanonical(
  supabase: SupabaseClient<Database>,
  label: string,
  /** The model's observed preparation state. Null/undefined = not observed. */
  prep?: PreparationState
): Promise<MatchedIngredient> {
  const ingredientId = await matchLocalIngredient(supabase, label, prep)
  if (!ingredientId) return { ingredientId: null, canonical: null }

  const { data: matched, error: matchedError } = await supabase
    .from('foods')
    .select('canonical_id,preparation_state')
    .eq('id', ingredientId)
    .single()
  // A row with no canonical_id is legitimate — anything added after the last
  // canonical build (owner-created manual rows, cache-on-accept OFF rows) is
  // unattached until scripts/026 next runs. Resolve it without a choice gate.
  if (matchedError || !matched?.canonical_id) {
    return { ingredientId, canonical: null }
  }

  const [{ data: group }, { data: variants }] = await Promise.all([
    supabase
      .from('canonical_ingredients')
      .select('id,display_name')
      .eq('id', matched.canonical_id)
      .single(),
    supabase
      .from('foods')
      // protein_g/carbs_g/is_safe_for_dogs are not displayed — they are what
      // the swap below needs to apply the SAME eligibility bars
      // matchLocalIngredient applies. Selecting only the display columns is
      // how the swap silently became the one unguarded path into a match.
      .select(
        'id,name,calories_per_serving,protein_g,carbs_g,fat_g,serving_size,preparation_state,is_safe_for_dogs'
      )
      .eq('canonical_id', matched.canonical_id)
      .eq('is_active', true),
  ])

  if (!group || !variants) return { ingredientId, canonical: null }

  // Does this group actually offer a preparation choice? Only states the
  // group really contains count — asking "raw or cooked?" about a group whose
  // every member is raw is a question with one answer.
  const preparations = new Set(
    variants.map(v => v.preparation_state).filter((p): p is string => p != null)
  )
  const prepObserved = prep === 'raw' || prep === 'cooked'
  const prepUnresolved = !prepObserved && preparations.size > 1

  // Preparation was observed but the matched row disagrees: flat search could
  // not reach a same-prep row (see pickPrepVariant). Correct it from within
  // the group, which is the first time the canonical layer decides anything
  // an owner sees.
  //
  // The candidate set is filtered by the same two bars matchLocalIngredient
  // enforces. Without this the swap could override a safe, nutritionally
  // usable match with a group sibling the matcher had already refused —
  // group membership only asserts "same food", not "fit to log". Correcting
  // raw->cooked is not worth reintroducing a 0-kcal row or a toxic one.
  let resolvedId = ingredientId
  if (prepObserved && matched.preparation_state !== prep) {
    const swappable = variants.filter(
      v => v.is_safe_for_dogs !== false && isNutritionallyUsable(v)
    )
    const swap = pickPrepVariant(swappable, prep)
    if (swap) resolvedId = swap.id
  }

  // Narrow to the variants the owner could plausibly have meant instead.
  // Narrowing by preparation is only legitimate when preparation was
  // OBSERVED; doing it on an assumed value is what hid the question.
  const comparable = prepObserved
    ? variants.filter(v => v.preparation_state === prep)
    : variants

  // With preparation unresolved the owner must choose even from a single
  // comparable row — the choice on offer is raw-vs-cooked, not this-vs-that.
  if (comparable.length <= 1 && !prepUnresolved) {
    return { ingredientId: resolvedId, canonical: null }
  }

  const kcalRange = range(
    comparable
      .map(v => per100g(Number(v.calories_per_serving), Number(v.serving_size)))
      .filter((n): n is number => n !== null && n > 0)
  )
  const fatRange = range(
    comparable
      .map(v => per100g(Number(v.fat_g), Number(v.serving_size)))
      .filter((n): n is number => n !== null)
  )

  const kcalAmbiguous =
    kcalRange !== null && (kcalRange[1] - kcalRange[0]) / kcalRange[0] > AMBIGUOUS_KCAL_RATIO
  const fatAmbiguous =
    fatRange !== null && fatRange[1] - fatRange[0] > AMBIGUOUS_FAT_DELTA_G

  return {
    ingredientId: resolvedId,
    canonical: {
      canonicalId: group.id as string,
      displayName: group.display_name as string,
      variantCount: comparable.length,
      // Preparation outranks the nutrient spreads: a cooked-vs-raw mix-up is
      // a factual error about the meal, not a rounding difference.
      requiresChoice: prepUnresolved || kcalAmbiguous || fatAmbiguous,
      prepUnresolved,
      availablePreparations: [...preparations].sort(),
      // Scopes the picker to the same set variantCount and the ranges
      // describe. Null when prep was never observed, in which case
      // `comparable` is every variant and no filtering applies.
      observedPreparation: prepObserved ? (prep as 'raw' | 'cooked') : null,
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
  label: string,
  /** The model's OBSERVED preparation state. Null/undefined = not observed. */
  prep?: PreparationState
): Promise<string | null> {
  const { data, error } = await supabase.rpc('fuzzy_search_foods', {
    search_query: label,
    match_limit: CANDIDATE_LIMIT,
  })
  if (error || !data || data.length === 0) return null

  const candidates = data as Array<{
    id: string
    name: string
    similarity?: number
    is_safe_for_dogs?: boolean
    preparation_state?: string | null
    calories_per_serving?: number | null
    protein_g?: number | null
    fat_g?: number | null
    carbs_g?: number | null
  }>

  const eligible: typeof candidates = []
  for (const row of candidates) {
    // Rank order is preserved, so eligible[0] is the old top-1 unless that row
    // was disqualified. Candidates arrive sorted, so the first one below the
    // floor ends the search.
    if (row.similarity != null && row.similarity < MATCH_THRESHOLD) break
    if (row.is_safe_for_dogs === false) {
      // An unsafe row that outranks everything safe must NOT be quietly
      // replaced by the next-best candidate. The confirmation UI keys its
      // toxicity banner off the RESOLVED row, so substituting here would do
      // two harmful things at once: log a food the bowl does not contain, and
      // suppress the warning for the one it does. Photograph a bowl with
      // onion in it and the owner would be told it is fine.
      //
      // Refusing to auto-match leaves the label visibly unresolved, which the
      // owner can then resolve deliberately — and picking the toxic row on
      // purpose DOES surface the banner.
      if (eligible.length === 0) return null
      // Something safe already scored higher, so this row was never going to
      // be the match. Just a worse candidate; skip it.
      continue
    }
    // A row reporting 0 kcal while carrying macros is broken data, not a low
    // calorie food. Committing one understates the meal by 100%, and 245 such
    // rows were live before scripts/029 (see lib/usda-canine.ts). Skipping to
    // the next candidate degrades to a slightly worse name match instead of a
    // silently wrong number.
    if (!isNutritionallyUsable(row)) continue
    eligible.push(row)
  }

  // When preparation was actually OBSERVED, honour it. Name similarity alone
  // reliably picks the raw row — USDA names it in fewer, shorter segments, so
  // "Carrots, raw" (0.880) outscores "Carrots, cooked, boiled, drained,
  // without salt" (0.749) on brevity. Ignoring an observed "cooked" here
  // would be worse than never asking the model at all: the app would hold
  // evidence that the meal was cooked and log the raw row anyway.
  //
  // Every candidate considered has already cleared MATCH_THRESHOLD, so this
  // can only substitute one genuine match for another.
  if (prep === 'raw' || prep === 'cooked') {
    const prepMatches = eligible.filter(row => row.preparation_state === prep)
    if (prepMatches.length > 0) {
      // Parser residual outranks similarity WITHIN the prep-matching subset.
      // Taking rank order alone served "Broccoli, chinese, cooked" (gai lan,
      // 0.791, residual ['chinese']) for "broccoli", because the real
      // "Broccoli, cooked, boiled, drained, without salt" sits just behind it
      // at 0.756 with an empty residual. Residual is precisely the signal for
      // "this name says something the parser could not account for", which is
      // where a different food hides. Similarity still breaks ties, and every
      // row here already cleared MATCH_THRESHOLD.
      prepMatches.sort(
        (a, b) =>
          parseFoodName(a.name).attrs.residual.length -
            parseFoodName(b.name).attrs.residual.length ||
          (b.similarity ?? 0) - (a.similarity ?? 0)
      )
      return prepMatches[0].id
    }
  }

  return eligible[0]?.id ?? null
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
