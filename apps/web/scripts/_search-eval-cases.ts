/**
 * Ground truth and pure scoring for the search-evaluation harness
 * (scripts/028_search_eval.ts).
 *
 * WHY THIS IS A SEPARATE, ENV-FREE MODULE
 * 028 needs a database and Gemini; the predicates below need neither. Keeping
 * them here lets Jest assert the scoring rules offline
 * (__tests__/search-eval-cases.test.ts) — otherwise the only way to find out
 * that "Chicken, feet, raw" was silently being counted as a PASS would be to
 * read the report closely, which is exactly how gate 023 came to report green
 * on the chicken-feet bug it was written to catch.
 *
 * EXPRESSED IN CANONICAL VOCABULARY
 * Expectations are stated as base foods and parts, then compared against
 * `parseFoodName()`'s output rather than against the raw description. That
 * matters because the two search paths return different shapes: flat search
 * returns a USDA description ("Turkey, ground, cooked"), grouped search
 * returns already-parsed `base_food` / `part` columns. Both are scored
 * through the same parser vocabulary, so the two columns of the report are
 * genuinely comparable.
 */

import { parseFoodName } from '../lib/food-name-parser'
import { inferPreparationState } from '../lib/usda-canine'

export type ExpectedPrep = 'cooked' | 'raw' | 'any'

export interface EvalCase {
  /** Canonical query text for static cases; photo cases run the Gemini label. */
  query: string
  /**
   * Acceptable base foods, written in ordinary English. Normalized through
   * the parser before comparison, so 'chickpeas' and 'garbanzo beans' both
   * reduce to the same key the parser assigns to a USDA row.
   */
  expectedBase: string[]
  /**
   * Which values of the parser's PART slot are plausible answers. Defaults to
   * "anything", including null.
   */
  partOk?: (part: string | null) => boolean
  /**
   * Disqualifying tokens the parser does NOT put in the part slot, so
   * `partOk` cannot see them: "giblets" and "meat only" are TRIM, "meatless"
   * and "back" fall through to residual. Without this, "Chicken, meatless" (a
   * soy product) scores a clean base+part pass.
   */
  disqualify?: RegExp
  expectedPrep: ExpectedPrep
  why: string
}

// ---------------------------------------------------------------------------
// Shared predicates
// ---------------------------------------------------------------------------

/**
 * Parts that are real foods but never what an owner means by a bare muscle-
 * meat query. This is the list gate 023 was missing: its chicken predicate
 * accepted any `^Chicken,` row of <= 3 segments, which is precisely the shape
 * of "Chicken, feet, raw".
 */
const OFFAL_AND_EXTREMITIES = new Set([
  'foot', 'neck', 'skin', 'tail', 'back',
  'liver', 'kidney', 'heart', 'gizzard', 'tongue', 'tripe', 'spleen',
  'lung', 'brain', 'sweetbread', 'pancreas', 'thymus',
])

/** Plausible part for a muscle-meat query: a cut, or no part at all. */
function meatPartOk(part: string | null): boolean {
  return part === null || !OFFAL_AND_EXTREMITIES.has(part)
}

/**
 * Name-level disqualifiers for meat queries: words the parser routes somewhere
 * `partOk` cannot see. "giblets" and "meat only" are TRIM, "meatless" and
 * "back" fall through to residual.
 *
 * Deliberately NOT here: a bare "skin". "Turkey, ..., meat and skin, cooked,
 * roasted" is an ordinary muscle-meat row; only "skin only" (and the `skin`
 * PART slot, caught by meatPartOk) means the row IS skin.
 *
 * "separable fat" earns its place the hard way: it is the live default variant
 * of the entire `Chicken` canonical group. The parser files it under GROUPING
 * (USDA scaffolding), so it is invisible to both the part slot and
 * pickDefault's specificity penalty. A bare `/fat/` would be wrong — it would
 * reject "Turkey, ground, fat free, raw" and every "93% lean / 7% fat" row.
 */
const MEAT_DISQUALIFY =
  /\bgiblet|\bmeatless\b|\bneck\b|\bback\b|\bskin only\b|\bseparable fat\b|\bfeet\b|\bfoot\b|\bbroth\b|\bpaste\b|\bnugget|\bbreaded\b|\bsausage\b|\bbacon\b|\bfrank(furter)?s?\b|\bloaf\b|\bpatt(y|ies)\b|\bluncheon\b|\bdeli\b|\bcanned\b/i

/**
 * Vegetable/legume equivalents: the plant, not a drink or a snack food.
 *
 * Deliberately NOT here: "seeds" and "leaves" — both are USDA GROUPING
 * scaffolding ("Chickpeas ..., mature seeds, cooked, boiled") on exactly the
 * rows we want to pass.
 */
const PLANT_DISQUALIFY =
  /\bjuice\b|\bsoup\b|\bbaby food\b|\bpuffs?\b|\bchips?\b|\bflour\b|\boil\b|\bsprouts?\b|\bhummus\b|\bpickled\b|\bsyrup\b|\bsouffl/i

// ---------------------------------------------------------------------------
// Ground truth
// ---------------------------------------------------------------------------

/**
 * The Farmer's Dog "Turkey Recipe" bowl: cooked ground turkey, carrots,
 * broccoli, spinach, chickpeas. Everything in the bowl is cooked, which makes
 * this photo the right probe for the default-variant policy — `pickDefault`
 * in 026 awards +100 to `preparation_state = 'raw'`, so every group's visible
 * representative is raw regardless of context.
 */
export const PHOTO_CASES: EvalCase[] = [
  {
    query: 'ground turkey',
    expectedBase: ['turkey'],
    partOk: p => p === null || ['ground', 'breast', 'thigh', 'leg', 'drumstick', 'wing'].includes(p),
    disqualify: MEAT_DISQUALIFY,
    expectedPrep: 'cooked',
    why: 'cooked ground turkey — not giblets, neck, skin or a turkey frankfurter',
  },
  {
    query: 'carrots',
    expectedBase: ['carrots'],
    disqualify: PLANT_DISQUALIFY,
    expectedPrep: 'cooked',
    why: 'cooked carrot, not carrot juice or baby-food carrot',
  },
  {
    query: 'broccoli',
    expectedBase: ['broccoli'],
    disqualify: PLANT_DISQUALIFY,
    expectedPrep: 'cooked',
    why: 'cooked broccoli — "Broccoli raab" is a different base food',
  },
  {
    query: 'spinach',
    expectedBase: ['spinach'],
    disqualify: PLANT_DISQUALIFY,
    expectedPrep: 'cooked',
    why: 'cooked spinach, not spinach souffle or baby food',
  },
  {
    query: 'chickpeas',
    expectedBase: ['chickpeas', 'garbanzo beans'],
    disqualify: PLANT_DISQUALIFY,
    expectedPrep: 'cooked',
    why: 'cooked chickpeas, not hummus or chickpea flour',
  },
]

/**
 * Queries that do not depend on the photo, so the harness still produces a
 * headline number when the fixture is missing.
 *
 * `expectedPrep` is deliberately 'any' here: these cases isolate the GROUPING
 * question (does the right food win at all?) from the DEFAULT-VARIANT question
 * (is the shown variant the right prep?), which only the photo cases test.
 */
export const STATIC_CASES: EvalCase[] = [
  {
    query: 'chicken',
    expectedBase: ['chicken'],
    partOk: meatPartOk,
    disqualify: MEAT_DISQUALIFY,
    expectedPrep: 'any',
    why: 'the headline case — flat search returns "Chicken, feet, raw" as top-1',
  },
  {
    query: 'chicken breast',
    expectedBase: ['chicken'],
    partOk: p => p === 'breast',
    disqualify: MEAT_DISQUALIFY,
    expectedPrep: 'any',
    why: 'a breast cut, not breaded tenders',
  },
  {
    query: 'turkey',
    expectedBase: ['turkey'],
    partOk: meatPartOk,
    disqualify: MEAT_DISQUALIFY,
    expectedPrep: 'any',
    why: 'turkey meat, not turkey giblets or turkey neck',
  },
]

export const ALL_CASES = [...PHOTO_CASES, ...STATIC_CASES]

// ---------------------------------------------------------------------------
// Scoring — pure, no network
// ---------------------------------------------------------------------------

/**
 * Reduce a term to the parser's base-food vocabulary, so ground truth written
 * as 'carrots' compares equal to the 'carrot' the parser derives from
 * "Carrots, cooked, boiled, drained, without salt".
 */
export function canonicalTerm(term: string): string {
  return parseFoodName(term).baseFood
}

/** Does the row's base food match the case? Accepts a raw description. */
export function scoreBase(name: string, c: EvalCase): boolean {
  return scoreBaseFood(parseFoodName(name).baseFood, c)
}

/**
 * Base-food check against an ALREADY-PARSED base, for grouped search — its
 * `base_food` column is the parser's own output, so re-parsing it would apply
 * the rules twice.
 */
export function scoreBaseFood(baseFood: string | null, c: EvalCase): boolean {
  if (!baseFood) return false
  const expected = new Set(c.expectedBase.map(canonicalTerm))
  return expected.has(canonicalTerm(baseFood))
}

/** Is the row's part a plausible answer, and free of disqualifying tokens? */
export function scorePart(name: string, c: EvalCase): boolean {
  return scorePartSlot(parseFoodName(name).part, name, c)
}

/**
 * Part check for grouped search: the group supplies `part` directly, but the
 * disqualifier still runs against the default variant's name, which is what
 * the owner actually sees.
 */
export function scorePartSlot(
  part: string | null,
  name: string,
  c: EvalCase
): boolean {
  if (c.disqualify?.test(name)) return false
  return c.partOk ? c.partOk(part) : true
}

/**
 * Preparation state as the app would read it: the stored column first, and
 * only when it is null fall back to the prep segments the parser isolated.
 * The fallback runs through `inferPreparationState` — the same function that
 * populated the column at import time — so both paths share one vocabulary.
 */
export function derivePrep(
  name: string,
  preparationState: string | null | undefined
): 'raw' | 'cooked' | null {
  if (preparationState === 'raw' || preparationState === 'cooked') {
    return preparationState
  }
  const prepSegments = parseFoodName(name).attrs.prep
  if (prepSegments.length === 0) return null
  return inferPreparationState(prepSegments.join(' '))
}

export function scorePrep(
  name: string,
  preparationState: string | null | undefined,
  c: EvalCase
): boolean {
  if (c.expectedPrep === 'any') return true
  return derivePrep(name, preparationState) === c.expectedPrep
}

/** All three checks — what "the top hit is actually right" means. */
export function scoreAll(
  name: string,
  preparationState: string | null | undefined,
  c: EvalCase
): { base: boolean; part: boolean; prep: boolean; fully: boolean } {
  const base = scoreBase(name, c)
  const part = scorePart(name, c)
  const prep = scorePrep(name, preparationState, c)
  return { base, part, prep, fully: base && part && prep }
}

// ---------------------------------------------------------------------------
// Label resolution
// ---------------------------------------------------------------------------

/** Content words of a label, singularized into parser vocabulary. */
function terms(label: string): string[] {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(canonicalTerm)
}

/**
 * Resolve a Gemini label to its ground-truth case.
 *
 * The model's phrasing drifts between runs — "cooked ground turkey", "ground
 * turkey", "turkey" are all the same item — so matching is by term containment
 * in EITHER direction, best overlap wins. Scoped to PHOTO_CASES because ground
 * truth is a property of the photo; a label with no case is not a failure, it
 * is unannotated, and 028 reports it as such rather than dropping it.
 */
export function findCaseForLabel(label: string): EvalCase | null {
  const labelTerms = new Set(terms(label))
  if (labelTerms.size === 0) return null

  let best: EvalCase | null = null
  let bestOverlap = 0
  for (const c of PHOTO_CASES) {
    const caseTerms = new Set(terms(c.query))
    const overlap = [...caseTerms].filter(t => labelTerms.has(t)).length
    if (overlap === 0) continue
    // One side must fully contain the other: "turkey" resolves to the ground
    // turkey case, but "turkey broth" (overlap 1 of 2, neither contained)
    // does not.
    const contained = overlap === caseTerms.size || overlap === labelTerms.size
    if (!contained) continue
    if (overlap > bestOverlap) {
      best = c
      bestOverlap = overlap
    }
  }
  return best
}
