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

import type { FoodVariantAttrs } from '@pawplate/core/types'

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

// ---------------------------------------------------------------------------
// Gazetteers. Order of application matters: grouping and origin are stripped
// before parts are looked for, so "Pork, fresh, loin, ..." yields `pork_loin`
// rather than `pork_fresh`.
// ---------------------------------------------------------------------------

/**
 * USDA taxonomy scaffolding — segments that classify the row within FDC but
 * say nothing about what the food IS. Derived by inspecting the largest
 * buckets a first-pass parser produced against the live corpus:
 * `pork_fresh` (200 rows), `chicken_broilers_or_fryers` (116),
 * `pork_cured` (105), `beef_variety_meats_and_by_products` (33).
 */
const GROUPING = [
  /^fresh$/,
  /^cured$/,
  /^all classes$/,
  /^broilers? or fryers?$/,
  /^roasting$/,
  /^stewing$/,
  /^young (hen|tom|duck)$/,
  /^variety meats and by-?products$/,
  /^composite of trimmed retail cuts.*$/,
  /^retail cuts?$/,
  /^cuts?$/,
  /^whole$/,
  /^mature seeds?$/,
  /^immature seeds?$/,
  /^leaves$/,
  /^flesh( and skin)?$/,
  /^solids? and liquids?$/,
  /^regular pack$/,
  /^vacuum pack$/,
  /^total can contents$/,
  /^includes .*$/,
  // Added after measuring residuals against the live corpus (see the
  // "unclassified residual terms" report in scripts/026):
  /^mixed species$/,
  /^fluid$/,
  /^light or dark meat$/,
  /^retail parts?$/,
  /^from whole$/,
  /^composite of separable fat$/,
  /^separable fat$/,
]

/** Country / husbandry provenance. Nutritionally minor, taxonomically noisy. */
const ORIGIN = [
  /^australian$/,
  /^imported$/,
  /^new zealand$/,
  /^domestic$/,
  /^grass-?fed$/,
  /^grain-?fed$/,
  /^free-?range$/,
  /^farmed$/,
  /^wild(-caught)?$/,
  /^organic$/,
  /^conventional$/,
]

/** USDA quality grades and breed/marbling programs. */
const GRADE = [
  /^select$/,
  /^choice$/,
  /^prime$/,
  /^all grades$/,
  /^ungraded$/,
  /^wagyu$/,
  /^aust\.? marble score.*$/,
  /^marble score.*$/,
  /^enhanced$/,
  /^composite$/,
  /^grade [a-z]$/,
]

/** Bone / fat / skin separation, trim state, and added-ingredient state. */
const TRIM = [
  /^bone-?less$/,
  /^bone-?in$/,
  /^with bone$/,
  /^separable lean (only|and fat)$/,
  /^lean( only)?$/,
  /^lean and fat$/,
  /^trimmed to .*fat$/,
  /^untrimmed$/,
  /^lip[- ]?o(n|ff)$/,
  /^cap[- ]?off$/,
  /^\d+% lean( meat)?$/,
  /^\d+% fat$/,
  /^\d+% lean ?\/ ?\d+% fat$/,
  /^\d+% lean meat ?\/ ?\d+% fat$/,
  /^fat ?free$/,
  /^extra lean$/,
  /^external fat$/,
  /^seam fat$/,
  /^meat only$/,
  /^meat and skin$/,
  /^skin only$/,
  /^skin-?less$/,
  /^with(out)? skin$/,
  /^without skin and bones?$/,
  /^giblets$/,
  /^peeled$/,
  /^unpeeled$/,
  /^seeded$/,
  /^pitted$/,
  /^drained$/,
  /^drained solids?$/,
  /^with(out)? salt$/,
  /^unsalted$/,
  /^salted$/,
  /^with(out)? added salt$/,
  /^with(out)? salt added$/,
  // "no X" phrasing — FDC uses it interchangeably with "without X", and
  // missing it was not cosmetic: "Sweet potato, cooked, no skin" fell through
  // to the part slot and keyed the row as `sweet_potato_skin`, i.e. sweet
  // potato SKIN, the opposite of what the row is. Likewise "no salt added"
  // became a part and spawned a junk `beans_no_salt_added` canonical that
  // lima beans and soybeans both drifted toward.
  /^no (added )?salt( added)?$/,
  /^no (added )?sugar( added)?$/,
  /^no skin$/,
  /^no bones?$/,
  /^no shell$/,
  /^enriched$/,
  /^unenriched$/,
  /^reduced fat$/,
  /^low fat$/,
  /^nonfat$/,
  /^whole milk$/,
  /^partially hydrogenated$/,
  // Added after measuring residuals against the live corpus.
  /^with added solution$/,
  /^unsweetened$/,
  /^sweetened$/,
  /^dark meat( from whole)?$/,
  /^light meat( from whole)?$/,
  /^flat half$/,
  /^shank half$/,
  /^whole half$/,
]

/** Preparation / cooking state. Mirrors inferPreparationState()'s vocabulary. */
const PREP = [
  /^raw( or unheated)?$/,
  /^uncooked$/,
  /^unheated$/,
  /^unprepared$/,
  /^cooked$/,
  /^cooked .*$/,
  /^roasted$/,
  /^grilled$/,
  /^broiled$/,
  /^pan-?broiled$/,
  /^pan-?fried$/,
  /^fried$/,
  /^braised$/,
  /^boiled$/,
  /^simmered$/,
  /^baked$/,
  /^baked in skin$/,
  /^stewed$/,
  /^steamed$/,
  /^poached$/,
  /^microwaved$/,
  /^rotisserie$/,
  /^hard-?boiled$/,
  /^scrambled$/,
  /^dry heat$/,
  /^moist heat$/,
  /^smoked$/,
  /^dried$/,
  /^dehydrated$/,
  /^freeze-?dried$/,
  /^frozen$/,
  /^canned$/,
  /^crumbles$/,
  /^patties$/,
  /^patty$/,
  /^loaf$/,
  /^home-?prepared.*$/,
  /^prepared.*$/,
  /^cooked as purchased.*$/,
  // Added after measuring residuals against the live corpus.
  /^heated$/,
  /^dry roasted$/,
  /^oil roasted$/,
  /^oven-?heated$/,
  /^dry$/,
  /^wet$/,
  /^slices?$/,
  /^steaks?$/,
  /^roasts?$/,
  /^cubes?$/,
  /^chunks?$/,
]

/**
 * Anatomical parts and organs. Doubles as the splitter for non-USDA names:
 * hand-curated rows use "Beef liver, raw" rather than USDA's
 * "Beef, liver, raw", so the head segment is split on these too — which is
 * exactly what makes a curated row and a USDA row land on one canonical.
 */
const PARTS = [
  // organs
  'liver', 'kidney', 'kidneys', 'heart', 'hearts', 'gizzard', 'gizzards',
  'tongue', 'tripe', 'spleen', 'lung', 'lungs', 'brain', 'brains',
  'sweetbread', 'sweetbreads', 'pancreas', 'thymus',
  // poultry cuts
  'breast', 'breasts', 'thigh', 'thighs', 'wing', 'wings', 'drumstick',
  'drumsticks', 'leg', 'legs', 'neck', 'necks', 'feet', 'foot', 'tail',
  'tails', 'skin',
  // red-meat primals
  'loin', 'short loin', 'sirloin', 'tenderloin', 'round', 'chuck', 'rib',
  'ribs', 'ribeye', 'brisket', 'flank', 'plate', 'shank', 'shoulder',
  'shoulders', 'blade', 'hock', 'hocks', 'ham', 'belly', 'jowl', 'rump',
  'oxtail', 'trotter', 'trotters',
  // forms
  'ground', 'minced', 'mince', 'cubed', 'fillet', 'fillets', 'steak',
  'steaks', 'chop', 'chops', 'roast',
  // egg parts
  'yolk', 'yolks', 'white', 'whites',
]

const PART_SET = new Set(PARTS)

/**
 * Explicit synonym / spelling collapse, applied to base food and part before
 * the slug is built. Version-controlled by design: this is where hand
 * corrections live so the gazetteers stay clean, and it is the documented
 * lever for fixing a bad grouping without touching parser logic.
 */
const SYNONYMS: Record<string, string> = {
  // spelling / spacing
  'rib eye': 'ribeye',
  'rib-eye': 'ribeye',
  entrecote: 'ribeye',
  'fore shank': 'foreshank',
  'fore-shank': 'foreshank',
  // retail sub-cut -> primal
  'top loin': 'loin',
  'bottom round': 'round',
  'top round': 'round',
  'eye of round': 'round',
  'top sirloin': 'sirloin',
  // regional and common names
  'garbanzo beans': 'chickpeas',
  garbanzo: 'chickpeas',
  'bengal gram': 'chickpeas',
  courgette: 'zucchini',
  aubergine: 'eggplant',
  swede: 'rutabaga',
  // form synonyms
  minced: 'ground',
  mince: 'ground',
  // plural collapse for parts where FDC uses both forms
  kidneys: 'kidney',
  hearts: 'heart',
  gizzards: 'gizzard',
  breasts: 'breast',
  thighs: 'thigh',
  wings: 'wing',
  drumsticks: 'drumstick',
  legs: 'leg',
  necks: 'neck',
  ribs: 'rib',
  shoulders: 'shoulder',
  hocks: 'hock',
  lungs: 'lung',
  brains: 'brain',
  sweetbreads: 'sweetbread',
  yolks: 'yolk',
  whites: 'white',
  fillets: 'fillet',
  steaks: 'steak',
  chops: 'chop',
  tails: 'tail',
  feet: 'foot',
  trotters: 'trotter',
}

function applySynonym(term: string): string {
  return SYNONYMS[term] ?? term
}

/**
 * Words ending in `s` that are not plurals AND that the rule chain below
 * would otherwise mangle. Most -ss/-us/-is words (asparagus, hummus, bass)
 * are already protected by the `/(ss|us|is)$/` guard and do NOT belong here —
 * only words an EARLIER rule catches first ("molasses" matches `/(ch|sh|s|x|z)es$/`)
 * or that no guard covers ("brussels", "sassafras").
 */
const NOT_PLURAL = new Set(['molasses', 'brussels', 'sassafras'])

/**
 * Collapse an English plural to its singular.
 *
 * FDC is inconsistent about number — "Mushrooms, portabella" and "Mushroom,
 * portabella" are separate rows for the same food, as are yardlong bean(s),
 * winged bean(s), and emu inside drum(s). Every one of those pairs landed in
 * the review queue as a near-miss the pipeline refused to merge. Normalizing
 * number fixes them in code rather than by hand, so they cannot re-queue on
 * the next rebuild.
 *
 * It also repairs a search defect: USDA pluralizes fruit ("Oranges, navels")
 * while owners search singular ("orange"), which let "Orange peel" outrank
 * the actual fruit in grouped search.
 */
function singularizeWord(word: string): string {
  if (word.length <= 3 || NOT_PLURAL.has(word)) return word
  if (/[^aeiou]ies$/.test(word)) return `${word.slice(0, -3)}y` // berries -> berry
  if (/oes$/.test(word)) return word.slice(0, -2) // potatoes -> potato
  if (/(ch|sh|s|x|z)es$/.test(word)) return word.slice(0, -2) // radishes -> radish
  if (/(ss|us|is)$/.test(word)) return word // molasses, asparagus
  if (/s$/.test(word)) return word.slice(0, -1) // mushrooms -> mushroom
  return word
}

/** Singularize only the head noun: "yardlong beans" -> "yardlong bean". */
function singularize(term: string): string {
  const words = term.split(' ')
  words[words.length - 1] = singularizeWord(words[words.length - 1])
  return words.join(' ')
}

/** Synonyms first (they are keyed on the plural forms), then number. */
function normalizeTerm(term: string): string {
  return singularize(applySynonym(term))
}

function matchesAny(segment: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(segment))
}

/**
 * Normalize a segment for gazetteer matching: lowercase, collapse whitespace,
 * drop parentheticals and stray punctuation. Parentheticals are pure noise
 * ("(ribs 10-12)", "(Includes foods for USDA's Food Distribution Program)").
 */
function normalizeSegment(segment: string): string {
  return segment
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[."']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Remove parenthesized asides from a whole description, including unbalanced
 * ones (FDC truncates some long descriptions mid-parenthetical). Run before
 * comma splitting — see parseFoodName().
 */
function stripParentheticals(name: string): string {
  return name
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\([^)]*$/, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Reduce a retail sub-cut to its primal: "bottom round steak/roast" -> "round",
 * "tenderloin steak/roast" -> "tenderloin". Strips the form suffix, then lets
 * SYNONYMS map the remainder onto the primal, then falls back to the last
 * gazetteer word present.
 */
function toPrimal(term: string): string {
  const stripped = term
    .replace(/\b(steak|roast|chop|fillet|filet)s?\b/g, ' ')
    .replace(/\//g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const candidate = applySynonym(stripped || term)
  if (PART_SET.has(candidate)) return applySynonym(candidate)
  const words = candidate.split(' ')
  for (let i = words.length - 1; i >= 0; i--) {
    if (PART_SET.has(words[i])) return applySynonym(words[i])
  }
  return candidate
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
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
