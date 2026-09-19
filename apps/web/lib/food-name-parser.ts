// Structured parsing of food descriptions into a canonical ingredient key
// plus variant attributes (docs/DATA_NORMALIZATION_DESIGN.md §4.2).
//
// THE PROBLEM
// After the USDA bulk import, `foods` holds 958 rows whose name begins
// "Beef, ..." differing only in primal cut, grade, trim, origin and prep:
//
//   Beef, Australian, imported, grass-fed, loin, tenderloin steak/roast,
//     boneless, separable lean and fat, raw
//   Beef, Australian, imported, Wagyu, loin, tenderloin steak/roast,
//     boneless, separable lean only, Aust. marble score 9, raw
//
// An owner adding "beef" to a bowl should not have to choose between Wagyu
// marble score 4/5 and marble score 9. This module derives a shared
// canonical slug (`beef_loin`) for both, while preserving the distinguishing
// attributes as structured data on the variant row.
//
// APPROACH: rule-based, not ML. USDA descriptions follow a loose but
// consistent grammar — base food first, modifiers appended after commas, drawn
// from a controlled vocabulary. That makes deterministic parsing cheap and
// debuggable. (Valsesia et al., Frontiers in Nutrition 2018, found fuzzy
// matching alone reached >96% precision on cross-database food-name mapping,
// with ML adding nothing to precision.) Embeddings/LLM are reserved for the
// ambiguous band in the resolution pipeline, not for parsing.
//
// GRANULARITY: parts resolve to the USDA PRIMAL, not the retail sub-cut, so
// "Beef, round, bottom round steak/roast, boneless, ..." keys to `beef_round`
// rather than `beef_bottom_round_steak`. That yields roughly a dozen beef
// canonicals instead of 958 rows — the right granularity for a dog-food
// picker.
//
// The controlled vocabulary and its normalization helpers moved to
// @pawplate/core/food-vocab (2026-09-13) so the query parser (search-query.ts)
// reads the same facets this writer stores. Parsing logic stays here.

import type { FoodVariantAttrs } from '@pawplate/core/types'
import {
  GROUPING,
  ORIGIN,
  GRADE,
  TRIM,
  PREP,
  PART_SET,
  matchesAny,
  normalizeSegment,
  normalizeTerm,
  slugify,
  stripParentheticals,
  toPrimal,
} from '@pawplate/core/food-vocab'

// slugify moved to @pawplate/core/food-vocab (shared with the query parser).
// Re-exported here so existing callers (tests, scripts) keep importing it from
// '@/lib/food-name-parser' unchanged.
export { slugify }

/**
 * Attributes that distinguish variants sharing one canonical key. The shape
 * is defined once in @pawplate/core (`FoodVariantAttrs` — it crosses the API
 * boundary to mobile); this alias keeps the parser's local vocabulary.
 */
export type VariantAttrs = FoodVariantAttrs

export interface ParsedFoodName {
  /** Base food, lowercased: 'beef', 'sweet potato' */
  baseFood: string
  /** Primal cut / organ / part, lowercased: 'round', 'liver'. Null if none. */
  part: string | null
  /** Canonical key: 'beef_round', 'sweet_potato' */
  slug: string
  /** Human-readable canonical name: 'Beef round', 'Sweet potato' */
  displayName: string
  attrs: VariantAttrs
}

/**
 * Parse a food description into a canonical key plus variant attributes.
 * Never throws: an unparseable name degrades to baseFood = the whole
 * normalized head segment, which is still a usable (if coarse) canonical.
 */
export function parseFoodName(name: string): ParsedFoodName {
  // Strip parentheticals BEFORE splitting on commas — they routinely span
  // segment boundaries, and splitting first leaves the fragments looking like
  // real modifiers. "Chickpeas (garbanzo beans, bengal gram), mature seeds,
  // raw" splits into ["Chickpeas (garbanzo beans", "bengal gram)", ...],
  // which produced the slug `chickpeas_garbanzo_beans_bengal_gram`.
  const rawSegments = stripParentheticals(name)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  const attrs: VariantAttrs = {
    prep: [],
    trim: [],
    grade: [],
    origin: [],
    grouping: [],
    residual: [],
  }

  const head = normalizeSegment(rawSegments[0] ?? name)
  let baseFood = head
  let part: string | null = null

  // Non-USDA naming ("Beef liver", "Chicken breast"): the head segment already
  // carries the part. Split it off so curated rows land on the same canonical
  // as their USDA equivalents.
  const headWords = head.split(' ')
  if (headWords.length >= 2) {
    const last = normalizeTerm(headWords[headWords.length - 1])
    if (PART_SET.has(last)) {
      baseFood = headWords.slice(0, -1).join(' ')
      part = last
    }
  }

  // Classify the remaining segments. A segment becomes the part ONLY when it
  // resolves to a known PARTS word (when the head didn't already supply one);
  // everything unclaimed is residual — the parser's measurable blind spots.
  //
  // The gazetteer gate matters: without it the first unclaimed segment became
  // the part wholesale, so fat percentage, colour, and species turned into
  // canonical keys (`milk_325_milkfat`, `salmon_atlantic`,
  // `grape_red_or_green`) — the exact fragmentation the canonical layer
  // exists to remove, and the reason 54% of keys were singletons. To keep a
  // genuine variety distinct (say Greek yogurt), add the variety word to
  // PARTS — the residual report in audits/canonical-ingredients.md shows
  // which words are worth promoting, by frequency.
  for (const rawSegment of rawSegments.slice(1)) {
    const segment = normalizeSegment(rawSegment)
    if (!segment) continue

    if (matchesAny(segment, GROUPING)) {
      attrs.grouping.push(segment)
    } else if (matchesAny(segment, ORIGIN)) {
      attrs.origin.push(segment)
    } else if (matchesAny(segment, GRADE)) {
      attrs.grade.push(segment)
    } else if (matchesAny(segment, TRIM)) {
      attrs.trim.push(segment)
    } else if (matchesAny(segment, PREP)) {
      attrs.prep.push(segment)
    } else if (part === null && PART_SET.has(toPrimal(segment))) {
      part = toPrimal(segment)
    } else {
      attrs.residual.push(segment)
    }
  }

  baseFood = normalizeTerm(baseFood)
  if (part) part = normalizeTerm(part)

  const slug = part ? slugify(`${baseFood} ${part}`) : slugify(baseFood)
  const displayName = titleCase(part ? `${baseFood} ${part}` : baseFood)

  return { baseFood, part, slug, displayName, attrs }
}

function titleCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
