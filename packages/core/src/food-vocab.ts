// Controlled vocabulary for parsing USDA / curated food descriptions, plus the
// pure normalization helpers built on it. Single source of truth, shared by:
//   - the WRITER, apps/web/lib/food-name-parser.ts (parseFoodName), which keys
//     every `foods` row to a canonical and stores variant_attrs at import time;
//   - the READER, ./search-query.ts (parseSearchQuery), which turns an owner's
//     free-text query into the same facets so search can filter on them.
//
// Keeping both on ONE vocabulary is the whole point: if the reader recognized
// "broiled" or "80% lean" differently from how the writer stored it, search
// facets would silently drift from stored facets. Everything here is pure —
// no Next.js, no Supabase, no network — so mobile can use it too.
//
// Extracted verbatim from food-name-parser.ts (2026-09-13, faceted-search
// Phase A). Behavior is unchanged; see docs/DATA_NORMALIZATION_DESIGN.md §4.2
// for the grammar these gazetteers encode.

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
export const GROUPING = [
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
  // NOTE: "separable fat" and "composite of separable fat" were here until
  // 2026-08-04. They are not scaffolding — they name a different food. See
  // PARTS below.
]

/** Country / husbandry provenance. Nutritionally minor, taxonomically noisy. */
export const ORIGIN = [
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
export const GRADE = [
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
export const TRIM = [
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
  // NOTE: /^giblets$/ was here until 2026-08-04 — giblets are an organ, not a
  // trim state. See PARTS below.
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
export const PREP = [
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

// ---------------------------------------------------------------------------
// Raw/cooked state classification.
//
// PREP above records WHAT a description says (it fills variant_attrs.prep).
// This decides what that MEANS for the `foods.preparation_state` column — and
// it lives here, next to PREP, because both halves of the pipeline need the
// same answer:
//   - the WRITER (apps/web/lib/usda-canine.ts inferPreparationState) stores
//     the column at import time;
//   - the READER (./search-query.ts) turns "broiled"/"unheated" in an owner's
//     query into a HARD filter on that same column.
// When the two disagreed, the reader filtered on a state the writer had never
// stored and the query returned nothing. Measured against the live corpus on
// 2026-09-19, before this was shared: 6 of 204 `broiled` rows, 4 of 12
// `microwaved`, 44 of 47 `unheated` and 55 of 66 `unprepared` rows carried a
// NULL state, so "93% lean broiled turkey" excluded the exact rows it named.
// ---------------------------------------------------------------------------

/**
 * Words that assert the food is NOT cooked. Matched as whole words so
 * "strawberries" doesn't false-positive on "raw".
 *
 * FDC writes "raw or unheated" as one phrase, which is why `unheated` sits
 * here rather than in its own state: upstream treats them as the same thing.
 * `unprepared` is FDC's frozen-vegetable wording ("Onions, frozen, whole,
 * unprepared") — frozen but uncooked.
 */
export const RAW_STATE_WORDS = ['raw', 'uncooked', 'unheated', 'unprepared']

/**
 * Words that assert the food WAS cooked. Matched as substrings, not whole
 * words, to keep FDC's compound spellings ("pan-broiled crumbles",
 * "cooked, roasted") classifying — `RAW_STATE_WORDS` is tested first, so
 * "uncooked" can't be captured by "cooked" here.
 *
 * `dried` is deliberately excluded — dried fruit is not a raw fresh-feeding
 * form, but it isn't cooked either.
 */
export const COOKED_METHOD_WORDS = [
  'cooked', 'roasted', 'stewed', 'fried', 'boiled', 'broiled', 'grilled',
  'baked', 'braised', 'poached', 'steamed', 'simmered', 'microwaved',
  'rotisserie', 'hard-boiled', 'scrambled', 'oven-heated',
]

/**
 * Methods that name a process without settling raw vs cooked, so they must
 * never imply a state in either direction.
 *
 * `smoked` is the whole list and it is a product decision, not an oversight:
 * every smoked row in the live corpus is cold-smoked fish or lox ("Fish,
 * salmon, chinook, smoked, (lox), regular"), which is cured, not cooked. The
 * reader still treats it as a cooking method — it ranks smoked variants
 * first — it just doesn't narrow the state around it.
 */
export const STATE_NEUTRAL_METHODS = ['smoked']

/** `-` matches a hyphen, a space, or nothing: "pan-broiled" ≡ "pan broiled". */
function hyphenTolerant(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/-/g, '[- ]?')
}

const RAW_SOURCE = `\\b(${RAW_STATE_WORDS.map(hyphenTolerant).join('|')})\\b`
const RAW_PATTERN = new RegExp(RAW_SOURCE, 'i')
const RAW_PATTERN_G = new RegExp(RAW_SOURCE, 'gi')
const COOKED_PATTERN = new RegExp(COOKED_METHOD_WORDS.map(hyphenTolerant).join('|'), 'i')

/**
 * Classify a description — or a single vocabulary word — as raw, cooked, or
 * unknown.
 *
 * COOKED WINS when a description carries both signals, because FDC's raw
 * words describe how the row is SOLD while its method words describe what was
 * already done to it: "Potatoes, french fried, par fried, frozen, unprepared"
 * is fried food the shopper hasn't finished, not a raw potato, and "Salmon
 * nuggets, cooked as purchased, unheated" is cooked food served cold. 11 live
 * rows look like this. Calling them raw would be a nutrition claim, not just
 * a label.
 *
 * The raw words are still cut out BEFORE the cooked test, because several
 * cooked words are substrings of raw ones ("uncooked" ⊃ "cooked") — that
 * lexical collision is the only reason the original implementation tested raw
 * first, and folding it in here keeps "Quinoa, uncooked" raw.
 *
 * Returns null when the text says nothing about state. Callers must treat
 * null as "unknown", never as "not cooked": a stored NULL means the importer
 * couldn't tell, and a hard state filter that excludes NULL rows is exactly
 * the defect this function was extracted to prevent.
 */
export function inferPrepState(text: string): 'raw' | 'cooked' | null {
  const saysRaw = RAW_PATTERN.test(text)
  const rest = saysRaw ? text.replace(RAW_PATTERN_G, ' ') : text
  if (COOKED_PATTERN.test(rest)) return 'cooked'
  return saysRaw ? 'raw' : null
}

/**
 * Anatomical parts and organs. Doubles as the splitter for non-USDA names:
 * hand-curated rows use "Beef liver, raw" rather than USDA's
 * "Beef, liver, raw", so the head segment is split on these too — which is
 * exactly what makes a curated row and a USDA row land on one canonical.
 */
export const PARTS = [
  // organs
  'liver', 'kidney', 'kidneys', 'heart', 'hearts', 'gizzard', 'gizzards',
  'tongue', 'tripe', 'spleen', 'lung', 'lungs', 'brain', 'brains',
  'sweetbread', 'sweetbreads', 'pancreas', 'thymus', 'giblet', 'giblets',
  // Rendered/adipose tissue. 'fat' is a PART, not a modifier: measured
  // 2026-08-04, "Chicken, broilers or fryers, separable fat, raw" is 629
  // kcal/100 g against 109-170 for the muscle-meat rows, yet it was landing
  // in the `chicken` canonical AND winning pickDefault — so it sat at the top
  // of the variant picker, one tap from a 4-6x calorie error.
  //
  // Safe to list despite how often "fat" appears in FDC descriptions: TRIM is
  // tested BEFORE the part slot, so "lean and fat", "separable lean and fat",
  // "85% lean / 15% fat", "fat free", "reduced fat", "external fat" and
  // "seam fat" are all claimed there and never reach this gazetteer.
  'fat',
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

export const PART_SET = new Set(PARTS)

/**
 * Explicit synonym / spelling collapse, applied to base food and part before
 * the slug is built. Version-controlled by design: this is where hand
 * corrections live so the gazetteers stay clean, and it is the documented
 * lever for fixing a bad grouping without touching parser logic.
 *
 * WRITER-SAFE ONLY. Every entry here is applied by parseFoodName at import
 * time and so shapes canonical slugs — it must be a true single-token
 * spelling/regional/plural collapse. Multi-word colloquial query aliases
 * ("hamburger meat" -> "ground beef") do NOT belong here; they live in
 * QUERY_ALIASES in ./search-query.ts, which only the reader consults.
 */
export const SYNONYMS: Record<string, string> = {
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
  giblets: 'giblet',
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

export function applySynonym(term: string): string {
  return SYNONYMS[term] ?? term
}

/**
 * Multi-word SYNONYMS keys, longest first, as whole-phrase regexes.
 *
 * `applySynonym` is keyed on a whole term, which is what the WRITER hands it
 * ("rib eye" arrives as one comma-delimited segment). A free-text query has
 * no such boundaries, so a reader that tokenizes on spaces first can never
 * reach these entries: "rib eye" stayed two tokens instead of collapsing to
 * the writer's canonical `ribeye`, and the retrieval terms then missed the
 * group they named. Same for "garbanzo beans", "bottom round", "top sirloin".
 */
const PHRASE_SYNONYMS: Array<[RegExp, string]> = Object.entries(SYNONYMS)
  .filter(([key]) => /[\s-]/.test(key))
  .sort(([a], [b]) => b.length - a.length)
  .map(([key, value]) => [
    new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'),
    value,
  ])

/**
 * Apply the multi-word half of SYNONYMS across a free-text phrase, before it
 * is split into tokens. Single-word entries are left to `applySynonym` on the
 * individual tokens, so callers should run both.
 */
export function applyPhraseSynonyms(text: string): string {
  let out = text
  for (const [re, value] of PHRASE_SYNONYMS) out = out.replace(re, value)
  return out.replace(/\s+/g, ' ').trim()
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
export function singularizeWord(word: string): string {
  if (word.length <= 3 || NOT_PLURAL.has(word)) return word
  if (/[^aeiou]ies$/.test(word)) return `${word.slice(0, -3)}y` // berries -> berry
  if (/oes$/.test(word)) return word.slice(0, -2) // potatoes -> potato
  if (/(ch|sh|s|x|z)es$/.test(word)) return word.slice(0, -2) // radishes -> radish
  if (/(ss|us|is)$/.test(word)) return word // molasses, asparagus
  if (/s$/.test(word)) return word.slice(0, -1) // mushrooms -> mushroom
  return word
}

/** Singularize only the head noun: "yardlong beans" -> "yardlong bean". */
export function singularize(term: string): string {
  const words = term.split(' ')
  words[words.length - 1] = singularizeWord(words[words.length - 1])
  return words.join(' ')
}

/** Synonyms first (they are keyed on the plural forms), then number. */
export function normalizeTerm(term: string): string {
  return singularize(applySynonym(term))
}

export function matchesAny(segment: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(segment))
}

/**
 * Normalize a segment for gazetteer matching: lowercase, collapse whitespace,
 * drop parentheticals and stray punctuation. Parentheticals are pure noise
 * ("(ribs 10-12)", "(Includes foods for USDA's Food Distribution Program)").
 */
export function normalizeSegment(segment: string): string {
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
export function stripParentheticals(name: string): string {
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
export function toPrimal(term: string): string {
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
