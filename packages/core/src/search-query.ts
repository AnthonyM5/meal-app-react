// Query understanding for refined ingredient search
// (docs → .Codex/reports/2026-09-13-hybrid-ingredient-search-plan.md, Phase A).
//
// The READER half of the food vocabulary. Where lib/food-name-parser.ts (the
// WRITER) parses a USDA description into a canonical slug + variant_attrs at
// import time, this parses an OWNER'S free-text query — "raw chicken breast",
// "broiled ground beef", "beef, 80% lean" — into the SAME facets, so search
// can filter on what was stored.
//
// Both halves draw on @pawplate/core/food-vocab, the single source of truth.
// A drift guard (see search-query.test.ts) asserts every keyword here still
// matches its gazetteer in food-vocab, so the reader can't recognize a facet
// the writer wouldn't have stored.
//
// Rule-based and deterministic — no LLM, no embeddings. Colloquial recall
// ("hamburger" → ground beef) is handled by QUERY_ALIASES; genuine semantic
// recall is the deferred Phase C (pgvector), gated behind a search eval.

import { applySynonym, singularizeWord } from './food-vocab'

/** A facet parsed out of the query. All optional; absent = no constraint. */
export interface SearchFacets {
  /** Hard filter. Water loss makes raw vs cooked a real per-100 g difference. */
  prepState?: 'raw' | 'cooked'
  /**
   * Soft preference WITHIN the cooked set. Method coverage is incomplete, so
   * a requested method never excludes — if no broiled variant exists, a
   * plain cooked one is preferred over nothing. Implies prepState 'cooked'.
   */
  cookingMethod?: string[]
  /** Hard filter, matched as a string prefix over variant_attrs.trim (§5). */
  leanPct?: number
  /** Hard filters: 'skinless', 'boneless', 'lean only', 'extra lean', … */
  trim?: string[]
}

export interface ParsedSearchQuery {
  rawQuery: string
  /** What's left after facets are stripped — the trigram/alias target. */
  retrievalTerms: string
  facets: SearchFacets
}

// ---------------------------------------------------------------------------
// Query-only aliases. Multi-word colloquial phrasing the WRITER never sees
// (USDA never says "hamburger meat"), so it does NOT belong in food-vocab's
// SYNONYMS — that would wrongly reshape canonical slugs at import. Applied to
// the whole query, longest phrase first.
// ---------------------------------------------------------------------------
const QUERY_ALIASES: Array<[RegExp, string]> = [
  [/\bhamburger meat\b/g, 'ground beef'],
  [/\bhamburger\b/g, 'ground beef'],
  [/\bground meat\b/g, 'ground beef'],
]

// Cooking methods — the subset of food-vocab PREP that names a heat method
// (not a state like "raw"/"frozen"/"canned" or a form like "slices"/"patty").
// Multi-word first so "pan-broiled" isn't split by the single-word "broiled".
//
// SPELLING RULE: entries use the writer's canonical form — hyphenated wherever
// the gazetteer allows `-?` (pan-fried, bone-in). phraseRegex() then accepts
// the owner typing "pan fried" / "panfried" too, and the hit is recorded in
// canonical form so it compares cleanly against stored values. This is what
// lets the drift test (every entry ⊆ its gazetteer) stay strict without
// rejecting how people actually type.
const COOKING_METHODS = [
  'pan-broiled', 'pan-fried', 'dry roasted', 'oil roasted', 'oven-heated',
  'hard-boiled', 'broiled', 'roasted', 'grilled', 'braised', 'baked',
  'boiled', 'simmered', 'stewed', 'steamed', 'poached', 'fried',
  'microwaved', 'smoked', 'rotisserie', 'scrambled',
]

// Words that assert the food is uncooked.
const RAW_STATES = ['raw', 'uncooked', 'unheated', 'unprepared']

// Trim / composition phrases. Multi-word first; same spelling rule as above.
// Every entry is asserted to match a TRIM gazetteer by the drift test (the
// numeric lean forms are handled separately by extractLeanPct).
const TRIM_PHRASES = [
  'separable lean and fat', 'separable lean only', 'lean and fat', 'lean only',
  'extra lean', 'fat free', 'reduced fat', 'low fat', 'nonfat',
  'no salt added', 'no added salt', 'no salt', 'no skin', 'no bones', 'no bone',
  'without skin', 'with skin', 'skinless', 'boneless', 'bone-in',
  'unsalted', 'salted', 'peeled', 'unpeeled', 'pitted', 'seeded', 'drained',
  'meat only',
]

/**
 * Whole-token regex for a phrase. A `-` in the phrase matches a hyphen, a
 * space, or nothing, so canonical 'pan-fried' also catches typed "pan fried"
 * and "panfried".
 */
function phraseRegex(phrase: string): RegExp {
  const escaped = phrase
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/-/g, '[- ]?')
  return new RegExp(`\\b${escaped}\\b`, 'g')
}

/**
 * Fold hyphens and spaces away so "bone-in" / "bone in" / "skin-less" /
 * "skinless" compare equal. FDC itself is inconsistent here, and the writer's
 * normalizeSegment keeps whatever spelling FDC used.
 */
function fold(s: string): string {
  return s.replace(/[- ]/g, '')
}

/**
 * Extract a lean percentage. Recognizes "80% lean", "80/20", "80 lean",
 * "80%" (when "lean" is present anywhere). Returns [pct, strippedQuery].
 * Unqualified "lean" is NOT numeric — that's a product decision left open
 * (§5); it falls through to the qualitative TRIM 'lean' match instead.
 */
function extractLeanPct(q: string): [number | undefined, string] {
  const hasLeanWord = /\blean\b/.test(q)
  // "80% lean" / "80 % lean"
  let m = q.match(/\b(\d{2,3})\s*%\s*lean\b/)
  if (m) return [Number(m[1]), q.replace(m[0], ' ')]
  // "80 lean"
  m = q.match(/\b(\d{2,3})\s+lean\b/)
  if (m) return [Number(m[1]), q.replace(m[0], ' ')]
  // "80/20" — the lean number is the larger, listed-first figure; require the
  // pair to plausibly sum to ~100 so a stray ratio (a date, "1/2") is ignored.
  m = q.match(/\b(\d{2,3})\s*\/\s*(\d{1,3})\b/)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2])
    if (a + b >= 95 && a + b <= 105 && a > b) return [a, q.replace(m[0], ' ')]
  }
  // bare "80%" only counts as lean when the word "lean" is also present
  m = q.match(/\b(\d{2,3})\s*%/)
  if (m && hasLeanWord) return [Number(m[1]), q.replace(m[0], ' ')]
  return [undefined, q]
}

/** Remove the first whole-word occurrence of any phrase; record which matched. */
function pullPhrases(q: string, phrases: string[]): { hits: string[]; rest: string } {
  let rest = q
  const hits: string[] = []
  for (const phrase of phrases) {
    const re = phraseRegex(phrase)
    if (re.test(rest)) {
      hits.push(phrase)
      rest = rest.replace(phraseRegex(phrase), ' ')
    }
  }
  return { hits, rest }
}

/** Normalize a leftover retrieval token the way the writer normalizes terms. */
function normalizeToken(token: string): string {
  return singularizeWord(applySynonym(token))
}

/**
 * Parse an owner's free-text query into retrieval terms + structured facets.
 * Never throws; anything unrecognized stays in retrievalTerms so a parser miss
 * degrades to an ordinary search rather than discarding the query.
 */
export function parseSearchQuery(rawQuery: string): ParsedSearchQuery {
  const facets: SearchFacets = {}

  // Lowercase, drop commas (owners type "beef, 80% lean"), collapse space.
  let working = rawQuery.toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ').trim()

  for (const [re, replacement] of QUERY_ALIASES) working = working.replace(re, replacement)

  const [leanPct, afterLean] = extractLeanPct(working)
  if (leanPct !== undefined) facets.leanPct = leanPct
  working = afterLean

  const methods = pullPhrases(working, COOKING_METHODS)
  if (methods.hits.length) {
    facets.cookingMethod = methods.hits
    facets.prepState = 'cooked'
  }
  working = methods.rest

  const trims = pullPhrases(working, TRIM_PHRASES)
  if (trims.hits.length) facets.trim = trims.hits
  working = trims.rest

  // Raw/cooked state words. Raw wins if present (a contradictory query like
  // "raw broiled" is nonsensical; preferring raw is the safer literal read).
  const raw = pullPhrases(working, RAW_STATES)
  working = raw.rest
  if (raw.hits.length) facets.prepState = 'raw'
  else {
    const cooked = pullPhrases(working, ['cooked'])
    working = cooked.rest
    if (cooked.hits.length && !facets.prepState) facets.prepState = 'cooked'
  }

  // Bare "lean" (not numeric, not part of a phrase already pulled) is the
  // qualitative TRIM 'lean'.
  const bareLean = pullPhrases(working, ['lean'])
  working = bareLean.rest
  if (bareLean.hits.length) facets.trim = [...(facets.trim ?? []), 'lean']

  const retrievalTerms = working
    .split(' ')
    .filter(Boolean)
    .map(normalizeToken)
    .join(' ')
    .trim()

  return { rawQuery, retrievalTerms, facets }
}

// ---------------------------------------------------------------------------
// Matching helpers — used by Phase A client-side variant filtering and,
// re-expressed in SQL, by the Phase B facet-aware RPCs.
// ---------------------------------------------------------------------------

/**
 * True when any variant_attrs.trim string expresses the requested lean %.
 * String match, not a numeric column (§5): FDC stores several spellings
 * ("80% lean meat / 20% fat", "80% lean / 20% fat", "80% lean") that all begin
 * "80% lean", so a prefix test is robust across them. Trim values are already
 * lowercased by the writer's normalizeSegment.
 */
export function leanMatchesTrim(leanPct: number, trim: string[] | undefined): boolean {
  if (!trim) return false
  const re = new RegExp(`^${leanPct}\\s*% ?lean\\b`)
  return trim.some(t => re.test(t))
}

/** Minimal variant shape the matchers need. */
export interface FacetMatchable {
  preparation_state?: string | null
  variant_attrs?: { prep?: string[]; trim?: string[] } | null
}

/** True when a variant satisfies every HARD facet (prepState, leanPct, trim). */
export function variantMatchesHardFacets(v: FacetMatchable, facets: SearchFacets): boolean {
  if (facets.prepState && v.preparation_state !== facets.prepState) return false
  if (facets.leanPct !== undefined && !leanMatchesTrim(facets.leanPct, v.variant_attrs?.trim))
    return false
  if (facets.trim?.length) {
    const have = (v.variant_attrs?.trim ?? []).map(fold)
    const ok = facets.trim.every(want => {
      const w = fold(want)
      return have.some(h => h.includes(w))
    })
    if (!ok) return false
  }
  return true
}

/** True when a variant's prep methods include a requested cooking method. */
export function variantMatchesMethod(v: FacetMatchable, facets: SearchFacets): boolean {
  if (!facets.cookingMethod?.length) return false
  const prep = (v.variant_attrs?.prep ?? []).map(fold)
  return facets.cookingMethod.some(m => {
    const f = fold(m)
    return prep.some(p => p.includes(f))
  })
}

/**
 * Filter variants by hard facets, then rank so a requested cooking method is
 * PREFERRED but never required (the "soft method" decision): method-matching
 * variants sort first, everything else (still cooked, per the hard filter)
 * follows. Stable — original order is otherwise preserved.
 */
export function filterAndRankVariants<T extends FacetMatchable>(
  variants: T[],
  facets: SearchFacets,
): T[] {
  const kept = variants.filter(v => variantMatchesHardFacets(v, facets))
  if (!facets.cookingMethod?.length) return kept
  return kept
    .map((v, i) => ({ v, i, m: variantMatchesMethod(v, facets) }))
    .sort((a, b) => (a.m === b.m ? a.i - b.i : a.m ? -1 : 1))
    .map(x => x.v)
}

// Re-export so callers can reference the recognized vocabulary (e.g. to render
// which method chips are meaningful) without re-deriving it.
export { COOKING_METHODS, RAW_STATES, TRIM_PHRASES }
