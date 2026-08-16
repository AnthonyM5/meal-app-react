/**
 * A/B search evaluation: does the canonical layer actually improve results?
 *
 * WHY THIS EXISTS
 * The canonical-merge work (feat/normalization) was suspected of making search
 * worse — "chicken" returns "Chicken, feet, raw" as its top hit, and every
 * visible option is raw. Neither symptom is caused by the merge, because the
 * canonical layer is not on any search path: bowl auto-match and both search
 * boxes call flat `fuzzy_search_foods`, and `search_canonical_ingredients` has
 * no UI caller at all. So the real question is not "did the merge break
 * search" but "would wiring the merge INTO search fix it" — and that is a
 * measurement, not an opinion.
 *
 * This harness runs the same queries down BOTH paths and scores them against
 * ground truth (scripts/_search-eval-cases.ts), reporting three columns:
 *
 *   flat                 what ships today (fuzzy_search_foods)
 *   grouped default      what grouped search would show collapsed
 *   grouped best variant the ceiling if default-variant selection were fixed
 *
 * The split is the point. "grouped default" vs "grouped best variant"
 * separates *is the grouping right?* from *is the shown variant right?* —
 * two different follow-ups with two different fixes.
 *
 * IT IS A MEASUREMENT, NOT A GATE. Exit status reflects whether the harness
 * could run, never whether the numbers were good; a failing metric is a
 * finding, not a broken build. (Gate 023 is the gate.)
 *
 *   0  full report written
 *   2  canonical layer unavailable — flat-only report written
 *   1  infrastructure failure (no env, RPC error, unreadable fixture)
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/028_search_eval.ts                          # static cases + fixture if present
 *   npx tsx scripts/028_search_eval.ts --refresh                # re-run Gemini on the photo
 *   npx tsx scripts/028_search_eval.ts --label post-rebuild     # name the snapshot
 *   npx tsx scripts/028_search_eval.ts --image /path/to/bowl.jpg --refresh
 *   npx tsx scripts/028_search_eval.ts --compare pre-rebuild post-rebuild
 *   npx tsx scripts/028_search_eval.ts --verbose                # per-query top-10
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { auditPath } from './_audit-path'
import {
  STATIC_CASES,
  findCaseForLabel,
  derivePrep,
  scoreAll,
  scoreBaseFood,
  scorePartSlot,
  scorePrep,
  type EvalCase,
  type ExpectedPrep,
} from './_search-eval-cases'
import { MATCH_THRESHOLD } from '../lib/resolve-ingredient'
import { isNutritionallyUsable } from '../lib/usda-canine'

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2)

function flagValue(name: string): string | undefined {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}

const REFRESH = argv.includes('--refresh')
const VERBOSE = argv.includes('--verbose')
const LABEL = flagValue('--label') ?? 'latest'
const FIXTURE_DIR = resolve(__dirname, 'fixtures')
const DEFAULT_IMAGE = resolve(FIXTURE_DIR, 'farmers-dog-turkey.jpg')
const IMAGE_PATH = flagValue('--image') ?? DEFAULT_IMAGE
const LABELS_FIXTURE = resolve(FIXTURE_DIR, 'bowl-vision-labels.json')

const COMPARE_INDEX = argv.indexOf('--compare')
const COMPARE: [string, string] | null =
  COMPARE_INDEX >= 0 && argv[COMPARE_INDEX + 1] && argv[COMPARE_INDEX + 2]
    ? [argv[COMPARE_INDEX + 1], argv[COMPARE_INDEX + 2]]
    : null

/** How deep "correct within reach" looks. Matches the picker's first page. */
const TOP_K = 10
/** Upper bound on variants inspected for the best-variant ceiling. */
const VARIANT_LIMIT = 200

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VisionLabel {
  label: string
  estimated_proportion: number
  confidence: number
  /**
   * The model's OBSERVED preparation state, or null for "cannot tell".
   * Captured because null is the interesting answer: it is what makes
   * lib/resolve-ingredient.ts demand an explicit owner choice instead of
   * letting flat search's short-name bias pick a raw row.
   */
  preparation_state?: 'raw' | 'cooked' | null
}

interface LabelsFixture {
  image: string
  capturedAt: string
  modelVersion: string
  notes: string
  items: VisionLabel[]
}

interface FlatRow {
  id: string
  name: string
  source: string | null
  preparation_state: string | null
  is_safe_for_dogs: boolean | null
  similarity: number
  calories_per_serving: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
}

interface GroupRow {
  canonical_id: string
  slug: string
  display_name: string
  base_food: string | null
  part: string | null
  variant_count: number
  group_is_safe: boolean | null
  food_id: string
  name: string
  preparation_state: string | null
  similarity: number
}

interface VariantRow {
  id: string
  name: string
  preparation_state: string | null
  is_canonical_default: boolean
  calories_per_serving: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
}

/** One scored side of one query. `null` when that path is unavailable. */
interface SideResult {
  topName: string
  topPrep: 'raw' | 'cooked' | null
  similarity: number
  base: boolean
  part: boolean
  prep: boolean
  fully: boolean
  /**
   * Is the row's nutrition physically possible? A 0 kcal row carrying macros
   * is broken data, and scoring only names let 245 such rows pass unnoticed —
   * this harness reported "chickpeas" as a mere PREP failure while the row it
   * matched reported 0 kcal against 21 g of protein.
   */
  usable: boolean
  /** Is a fully-correct answer reachable at all (top-K / within the group)? */
  withinReach: boolean
  /** Extra line for the report: the group / variant that made reach true. */
  reachNote: string | null
}

interface QueryResult {
  query: string
  source: 'photo' | 'static'
  /** The Gemini label this row came from, when different from the query. */
  visionLabel: string | null
  why: string
  expectedPrep: ExpectedPrep
  flat: SideResult | null
  /** Flat path only: would `matchLocalIngredient` have committed this row? */
  autoMatchFired: boolean
  groupedDefault: SideResult | null
  groupedBest: SideResult | null
}

interface Snapshot {
  label: string
  generatedAt: string
  health: HealthReport
  corpus: { activeFoods: number; canonicalGroups: number; attachedFoods: number }
  fixture: LabelsFixture | null
  unannotated: string[]
  results: QueryResult[]
}

// ---------------------------------------------------------------------------
// Database — created lazily on first use.
//
// `--compare` is a pure file-to-file diff and must run with no env at all, so
// the credential check cannot live at module scope. (It did, briefly, along
// with an early `if (COMPARE)` dispatch — which crashed in the temporal dead
// zone because the dispatch ran before the const declarations below it. The
// entry point is now at the very bottom of the file, where every declaration
// is initialized.)
// ---------------------------------------------------------------------------

let client: SupabaseClient | null = null

function db(): SupabaseClient {
  if (client) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('Missing env. Run: set -a && source .env.local && set +a  first.')
    process.exit(1)
  }
  client = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return client
}

// ---------------------------------------------------------------------------
// Canonical-layer health
// ---------------------------------------------------------------------------

type HealthStatus = 'HEALTHY' | 'MIGRATIONS_NOT_APPLIED' | 'NOT_BUILT'

interface HealthReport {
  status: HealthStatus
  ok: boolean
  detail: string
  groups: number
  attachedFoods: number
  /**
   * Migrations that exist in supabase/migrations but are not live. Reported,
   * never fatal: grouped search runs fine without them, and a snapshot taken
   * before they land is exactly what the pre/post comparison needs.
   */
  pendingMigrations: string[]
}

/** PostgREST reports a missing function two different ways depending on cache. */
function isMissingFunction(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '42883' ||
    error.code === 'PGRST202' ||
    /could not find the function|does not exist/i.test(error.message ?? '')
  )
}

/**
 * Decide whether the grouped side can run at all, BEFORE scoring anything.
 * A half-applied canonical layer must produce `n/a` columns and a warning,
 * never a silent zero that reads like "grouping is worthless".
 */
async function checkCanonicalHealth(): Promise<HealthReport> {
  const unavailable = (detail: string): HealthReport => ({
    status: 'MIGRATIONS_NOT_APPLIED',
    ok: false,
    detail,
    groups: 0,
    attachedFoods: 0,
    pendingMigrations: ['20260803000000_list_variants_serving_size', '20260803000100_live_variant_count'],
  })

  const { error: searchError } = await db().rpc('search_canonical_ingredients', {
    search_query: 'chicken',
    match_limit: 1,
  })
  if (searchError && isMissingFunction(searchError)) {
    return unavailable(`search_canonical_ingredients is missing: ${searchError.message}`)
  }
  if (searchError) throw new Error(`search_canonical_ingredients: ${searchError.message}`)

  // The best-variant ceiling needs list_canonical_variants (its
  // 20260803000000 signature adds serving_size; a missing function is the
  // only failure this can detect, since PostgREST hides the return shape).
  const { error: variantsError } = await db().rpc('list_canonical_variants', {
    p_canonical_id: '00000000-0000-0000-0000-000000000000',
    match_limit: 1,
  })
  if (variantsError && isMissingFunction(variantsError)) {
    return unavailable(`list_canonical_variants is missing: ${variantsError.message}`)
  }
  if (variantsError) throw new Error(`list_canonical_variants: ${variantsError.message}`)

  const groups = await count('canonical_ingredients')
  const attachedFoods = await count('foods', 'attached')
  if (groups === 0 || attachedFoods === 0) {
    return {
      status: 'NOT_BUILT',
      ok: false,
      detail:
        `canonical layer is empty (${groups} groups, ${attachedFoods} attached foods) — ` +
        'run scripts/026_build_canonical_ingredients.ts --apply',
      groups,
      attachedFoods,
      pendingMigrations: [],
    }
  }

  return {
    status: 'HEALTHY',
    ok: true,
    detail: `${groups} groups over ${attachedFoods} attached foods`,
    groups,
    attachedFoods,
    pendingMigrations: await detectPendingMigrations(),
  }
}

/**
 * Both pending migrations change a function's OUTPUT, not its signature, so a
 * plain existence probe cannot see them. Detect them by their observable
 * effect on a real row instead: 20260803000000 adds `serving_size` to
 * list_canonical_variants, and 20260803000100 makes search_canonical_
 * ingredients compute variant_count live (so it agrees with an actual count
 * rather than the stored build-time snapshot).
 */
async function detectPendingMigrations(): Promise<string[]> {
  const pending: string[] = []

  const { data: sample } = await db()
    .from('canonical_ingredients')
    .select('id,slug,variant_count')
    .order('variant_count', { ascending: false })
    .limit(1)
    .single()
  if (!sample) return pending

  const { data: variants } = await db().rpc('list_canonical_variants', {
    p_canonical_id: sample.id,
    match_limit: 1,
  })
  const first = (variants ?? [])[0] as Record<string, unknown> | undefined
  if (first && !('serving_size' in first)) {
    pending.push('20260803000000_list_variants_serving_size')
  }

  // Compare the RPC's variant_count against a live count for the same group.
  // Equal counts are inconclusive (the snapshot may simply be current), so
  // only a MISMATCH that the RPC reports as the stored value is evidence.
  const live = await count('foods', 'attached')
  if (live > 0) {
    const { data: grouped } = await db().rpc('search_canonical_ingredients', {
      search_query: sample.slug.replace(/_/g, ' '),
      match_limit: 25,
    })
    const row = ((grouped ?? []) as GroupRow[]).find(g => g.canonical_id === sample.id)
    const { count: actual } = await db()
      .from('foods')
      .select('*', { count: 'exact', head: true })
      .eq('canonical_id', sample.id)
      .eq('is_active', true)
    if (row && actual != null && row.variant_count === sample.variant_count && row.variant_count !== actual) {
      pending.push('20260803000100_live_variant_count')
    }
  }
  return pending
}

async function count(
  table: 'foods' | 'canonical_ingredients',
  filter: 'all' | 'active' | 'attached' = 'all'
): Promise<number> {
  const base = db().from(table).select('*', { count: 'exact', head: true })
  const query =
    filter === 'active'
      ? base.eq('is_active', true)
      : filter === 'attached'
        ? base.not('canonical_id', 'is', null)
        : base
  const { count: n, error } = await query
  if (error) throw new Error(`count(${table}, ${filter}): ${error.message}`)
  return n ?? 0
}

// ---------------------------------------------------------------------------
// Vision labels
// ---------------------------------------------------------------------------

const MEDIA_TYPES: Record<string, 'image/jpeg' | 'image/png' | 'image/webp'> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

/**
 * Load the committed Gemini labels, or re-capture them from the photo.
 *
 * The fixture is committed precisely so eval reruns are free and deterministic:
 * comparing a pre- and post-rebuild snapshot is only meaningful if both were
 * scored against the same labels. `--refresh` is the deliberate opt-in to
 * re-roll them.
 */
async function loadOrCaptureLabels(): Promise<LabelsFixture | null> {
  if (!REFRESH && existsSync(LABELS_FIXTURE)) {
    return JSON.parse(readFileSync(LABELS_FIXTURE, 'utf8')) as LabelsFixture
  }
  if (!REFRESH) {
    console.error(
      `  no vision fixture at ${LABELS_FIXTURE} — running STATIC cases only.\n` +
        `  To add the photo cases: place the bowl photo at ${DEFAULT_IMAGE}\n` +
        `  (or pass --image <path>) and re-run with --refresh.`
    )
    return null
  }

  if (!existsSync(IMAGE_PATH)) {
    console.error(
      `--refresh needs an image. Nothing at ${IMAGE_PATH}.\n` +
        `Copy the bowl photo there, or pass --image <path>.`
    )
    process.exit(1)
  }
  const mediaType = MEDIA_TYPES[extname(IMAGE_PATH).toLowerCase()]
  if (!mediaType) {
    console.error(`Unsupported image type: ${IMAGE_PATH} (need .jpg/.png/.webp)`)
    process.exit(1)
  }

  // Imported lazily: it throws on a missing GEMINI_API_KEY, and a run without
  // --refresh must work without that key.
  const { analyzeBowlImage } = await import('../lib/vision/analyze-bowl')
  console.error(`  calling Gemini on ${IMAGE_PATH} ...`)
  const { result, modelVersion } = await analyzeBowlImage({
    imageBase64: readFileSync(IMAGE_PATH).toString('base64'),
    mediaType,
  })

  // box_2d is stripped: it feeds portion estimation, not search relevance, and
  // keeping it would churn the committed fixture on every refresh.
  const fixture: LabelsFixture = {
    image: IMAGE_PATH.replace(resolve(__dirname, '..'), 'apps/web'),
    capturedAt: new Date().toISOString(),
    modelVersion,
    notes: result.notes,
    items: result.items.map(i => ({
      label: i.label,
      estimated_proportion: i.estimated_proportion,
      confidence: i.confidence,
      preparation_state: i.preparation_state ?? null,
    })),
  }
  mkdirSync(dirname(LABELS_FIXTURE), { recursive: true })
  writeFileSync(LABELS_FIXTURE, `${JSON.stringify(fixture, null, 2)}\n`)
  console.error(`  wrote ${LABELS_FIXTURE} (${fixture.items.length} items)`)
  return fixture
}

// ---------------------------------------------------------------------------
// The two search paths
// ---------------------------------------------------------------------------

/**
 * Flat search — exactly what `matchLocalIngredient` and both search boxes do
 * today, except with match_limit 10 so "correct within reach" is measurable.
 */
async function evalFlat(
  query: string,
  c: EvalCase,
  /** The model's observed preparation state for this item, if any. */
  observedPrep?: 'raw' | 'cooked' | null
): Promise<{ side: SideResult | null; autoMatchFired: boolean; rows: FlatRow[] }> {
  const { data, error } = await db().rpc('fuzzy_search_foods', {
    search_query: query,
    match_limit: TOP_K,
  })
  if (error) throw new Error(`fuzzy_search_foods(${query}): ${error.message}`)
  const rows = (data ?? []) as FlatRow[]

  // Score the row `matchLocalIngredient` would COMMIT, not merely the row the
  // ranking put first — the two diverge now that the resolver skips unsafe or
  // nutritionally broken candidates and honours an observed preparation
  // state. Scoring raw rank order would flatter the app: it would report a
  // raw hit as the outcome when the resolver actually commits the cooked one.
  const eligible = rows.filter(
    r =>
      r.similarity >= MATCH_THRESHOLD &&
      r.is_safe_for_dogs !== false &&
      isNutritionallyUsable(r)
  )
  const top =
    (observedPrep
      ? eligible.find(r => r.preparation_state === observedPrep)
      : undefined) ?? eligible[0]
  if (!top) return { side: null, autoMatchFired: false, rows }

  // `top` already survived every rejection matchLocalIngredient applies, so
  // reaching here means the bowl resolver would have committed it.
  const autoMatchFired = true

  const s = scoreAll(top.name, top.preparation_state, c)
  const reached = rows.find(r => scoreAll(r.name, r.preparation_state, c).fully)

  return {
    side: {
      topName: top.name,
      topPrep: derivePrep(top.name, top.preparation_state),
      similarity: top.similarity,
      ...s,
      usable: isNutritionallyUsable(top),
      withinReach: reached !== undefined,
      reachNote: reached ? `top-${rows.indexOf(reached) + 1}: ${reached.name}` : null,
    },
    autoMatchFired,
    rows,
  }
}

/**
 * Grouped search — the path the canonical layer built but nothing calls.
 * Produces two scored sides: what the collapsed group would show (its default
 * variant), and the best any variant in the correct group could do.
 */
async function evalGrouped(
  query: string,
  c: EvalCase
): Promise<{ def: SideResult | null; best: SideResult | null; rows: GroupRow[] }> {
  const { data, error } = await db().rpc('search_canonical_ingredients', {
    search_query: query,
    match_limit: TOP_K,
  })
  if (error) throw new Error(`search_canonical_ingredients(${query}): ${error.message}`)
  const rows = (data ?? []) as GroupRow[]
  const top = rows[0]
  if (!top) return { def: null, best: null, rows }

  // Group-level correctness is judged on the GROUP's own identity — its
  // parsed base_food/part and display_name — never on its default variant's
  // name. Judging the group by its default would conflate the two questions
  // this report exists to separate: the `Chicken` group is the right answer
  // for "chicken" even though pickDefault currently elects "separable fat"
  // to represent it, and scoring it as a wrong GROUP would hide a defaulting
  // bug behind an apparent grouping bug.
  const groupCorrect = (g: GroupRow) =>
    scoreBaseFood(g.base_food, c) && scorePartSlot(g.part, g.display_name, c)

  const defBase = scoreBaseFood(top.base_food, c)
  const defPart = scorePartSlot(top.part, top.name, c)
  const defPrep = scorePrep(top.name, top.preparation_state, c)
  const correctGroup = rows.find(groupCorrect)

  const def: SideResult = {
    topName: `${top.display_name}  →  ${top.name}`,
    topPrep: derivePrep(top.name, top.preparation_state),
    similarity: top.similarity,
    base: defBase,
    part: defPart,
    prep: defPrep,
    fully: defBase && defPart && defPrep,
    usable: await isRowUsable(top.food_id),
    withinReach: correctGroup !== undefined,
    reachNote: correctGroup
      ? `top-${rows.indexOf(correctGroup) + 1} group: ${correctGroup.display_name}`
      : null,
  }

  if (!correctGroup) return { def, best: null, rows }

  // The ceiling: if defaulting were context-aware, could the RIGHT group have
  // shown a fully-correct variant? This isolates a defaulting problem from a
  // grouping problem — a group that contains no cooked variant is a data gap,
  // not a ranking bug.
  const { data: variantData, error: variantError } = await db().rpc(
    'list_canonical_variants',
    { p_canonical_id: correctGroup.canonical_id, match_limit: VARIANT_LIMIT }
  )
  if (variantError) {
    throw new Error(`list_canonical_variants(${correctGroup.slug}): ${variantError.message}`)
  }
  const variants = (variantData ?? []) as VariantRow[]
  // Among fully-correct variants, show the least-qualified one. The column is
  // an existence proof either way, but taking list_canonical_variants' first
  // hit surfaced "Carrots, cooked, boiled, drained, WITH salt" over the
  // without-salt row — a misleading picture of what a fixed pickDefault would
  // choose, since pickDefault's whole intent is the least-specialized variant.
  const winner = variants
    .filter(
      v => scoreAll(v.name, v.preparation_state, c).fully && isNutritionallyUsable(v)
    )
    .sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name))[0]
  const shown = winner ?? variants.find(v => v.is_canonical_default) ?? variants[0]

  const best: SideResult | null = shown
    ? {
        topName: `${correctGroup.display_name}  →  ${shown.name}`,
        topPrep: derivePrep(shown.name, shown.preparation_state),
        similarity: correctGroup.similarity,
        ...scoreAll(shown.name, shown.preparation_state, c),
        usable: isNutritionallyUsable(shown),
        withinReach: winner !== undefined,
        reachNote: `${variants.length} variant(s) in group`,
      }
    : null

  return { def, best, rows }
}

/**
 * Nutrition sanity for a grouped-search hit. search_canonical_ingredients
 * returns the default variant's kcal but not its macros, and "0 kcal" alone
 * cannot distinguish broken data from a genuinely zero food — so fetch the
 * macros for the one row being scored.
 */
async function isRowUsable(foodId: string): Promise<boolean> {
  const { data } = await db()
    .from('foods')
    .select('calories_per_serving,protein_g,fat_g,carbs_g')
    .eq('id', foodId)
    .maybeSingle()
  return data ? isNutritionallyUsable(data) : true
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

const METRIC_ROWS = [
  ['top-1 base correct', (s: SideResult) => s.base],
  ['top-1 plausible part', (s: SideResult) => s.part],
  ['top-1 prep correct', (s: SideResult) => s.prep],
  ['top-1 nutrition usable', (s: SideResult) => s.usable],
  ['top-1 fully correct', (s: SideResult) => s.fully],
  ['correct within reach', (s: SideResult) => s.withinReach],
] as const

function tally(
  results: QueryResult[],
  pick: (r: QueryResult) => SideResult | null,
  predicate: (s: SideResult) => boolean | undefined
): string {
  const sides = results.map(pick)
  if (sides.every(s => s === null)) return 'n/a'
  const present = sides.filter((s): s is SideResult => s !== null)
  // A metric added after a snapshot was written is ABSENT from it, not failed.
  // Reporting `0/8` for a field that did not exist yet turns a widened harness
  // into a phantom regression in every --compare against an older snapshot.
  if (present.every(s => predicate(s) === undefined)) return 'n/a'
  const hits = present.filter(s => predicate(s) === true).length
  return `${hits}/${results.length}`
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const glyph = (ok: boolean) => (ok ? 'PASS' : 'FAIL')

function sideCell(s: SideResult | null): string {
  if (!s) return '_no result_'
  const marks = `${glyph(s.base)}/${glyph(s.part)}/${glyph(s.prep)}`
  return `${s.topName}<br>\`${marks}\` prep=${s.topPrep ?? 'unknown'} sim=${s.similarity.toFixed(3)}`
}

function writeReport(snapshot: Snapshot): string {
  const { results, health, corpus, fixture } = snapshot
  const lines: string[] = []

  lines.push(`# Search evaluation — \`${snapshot.label}\``)
  lines.push('')
  lines.push(`Generated ${snapshot.generatedAt} by \`scripts/028_search_eval.ts\`.`)
  lines.push('')
  lines.push(
    'Measurement only — this script never gates on a metric. It compares what ' +
      'ships today (flat `fuzzy_search_foods`) against the canonical layer that ' +
      'exists but has no UI caller.'
  )
  lines.push('')
  lines.push('## Environment')
  lines.push('')
  lines.push(`- canonical layer: **${health.status}** — ${health.detail}`)
  lines.push(`- active foods: ${corpus.activeFoods}`)
  lines.push(`- canonical groups: ${corpus.canonicalGroups}`)
  lines.push(`- foods attached to a group: ${corpus.attachedFoods}`)
  lines.push(`- MATCH_THRESHOLD: ${MATCH_THRESHOLD}`)
  if (fixture) {
    lines.push(
      `- vision fixture: \`${fixture.image}\`, ${fixture.modelVersion}, captured ${fixture.capturedAt}`
    )
  } else {
    lines.push('- vision fixture: **absent** — static cases only')
  }
  if (health.pendingMigrations.length > 0) {
    lines.push(
      `- **pending migrations**: ${health.pendingMigrations.map(m => `\`${m}\``).join(', ')}`
    )
  }
  lines.push('')

  if (!health.ok) {
    lines.push('> **WARNING** — the grouped columns below are `n/a`. ' + health.detail)
    lines.push('')
  }

  if (fixture) {
    lines.push('## Gemini labels')
    lines.push('')
    lines.push(`Model notes: ${fixture.notes || '_none_'}`)
    lines.push('')
    lines.push('| label | proportion | confidence | model prep | ground truth |')
    lines.push('|---|---:|---:|---|---|')
    for (const item of fixture.items) {
      const c = findCaseForLabel(item.label)
      const prep =
        item.preparation_state ?? '**null** — owner must choose'
      lines.push(
        `| ${item.label} | ${item.estimated_proportion.toFixed(2)} | ` +
          `${item.confidence.toFixed(2)} | ${prep} | ` +
          `${c ? `\`${c.query}\`` : '**UNANNOTATED**'} |`
      )
    }
    lines.push('')
    if (snapshot.unannotated.length > 0) {
      lines.push(
        `${snapshot.unannotated.length} label(s) had no ground-truth case and were ` +
          `not scored: ${snapshot.unannotated.map(l => `\`${l}\``).join(', ')}.`
      )
      lines.push('')
    }
  }

  lines.push('## Aggregate')
  lines.push('')
  lines.push(`Over ${results.length} scored quer${results.length === 1 ? 'y' : 'ies'}.`)
  lines.push('')
  lines.push('| metric | flat | grouped default | grouped best variant |')
  lines.push('|---|---:|---:|---:|')
  for (const [name, predicate] of METRIC_ROWS) {
    lines.push(
      `| ${name} | ${tally(results, r => r.flat, predicate)} | ` +
        `${tally(results, r => r.groupedDefault, predicate)} | ` +
        `${tally(results, r => r.groupedBest, predicate)} |`
    )
  }
  const fired = results.filter(r => r.autoMatchFired).length
  lines.push(`| auto-match fired | ${fired}/${results.length} | n/a | n/a |`)
  lines.push('')
  lines.push(
    '**Scope boundary.** The `flat` column models `matchLocalIngredient` — ' +
      'threshold, safety, nutrition usability, and preference for an observed ' +
      'preparation state. It does NOT model the group-level correction in ' +
      '`matchIngredientWithCanonical` (`pickPrepVariant`), which reaches ' +
      'same-preparation siblings that score below MATCH_THRESHOLD. So this ' +
      'column UNDER-reports the shipped resolver: `chickpeas` fails here ' +
      'because every cooked chickpea row scores ~0.419, yet end-to-end the ' +
      'resolver returns the cooked row via its canonical group.'
  )
  lines.push('')
  lines.push(
    '`grouped best variant` is a **ceiling**, not a shipping number: it asks ' +
      'whether the correct group contains a fully-correct variant at all. The gap ' +
      'between it and `grouped default` is the cost of the default-variant policy; ' +
      'the gap between `grouped default` and `flat` is the value of grouping itself.'
  )
  lines.push('')

  lines.push('## Per query')
  lines.push('')
  lines.push('Marks are `base/part/prep`.')
  lines.push('')
  lines.push('| query | expectation | flat | grouped default | grouped best variant |')
  lines.push('|---|---|---|---|---|')
  for (const r of results) {
    const q = r.visionLabel && r.visionLabel !== r.query ? `${r.query}<br>_(label: ${r.visionLabel})_` : r.query
    lines.push(
      `| \`${q}\` | ${r.why} | ${sideCell(r.flat)} | ` +
        `${sideCell(r.groupedDefault)} | ${sideCell(r.groupedBest)} |`
    )
  }
  lines.push('')

  lines.push('## Observations')
  lines.push('')
  for (const o of observations(snapshot)) lines.push(`- ${o}`)
  lines.push('')

  const path = auditPath(`search-eval-${snapshot.label}.md`)
  writeFileSync(path, `${lines.join('\n')}\n`)
  writeFileSync(
    auditPath(`search-eval-${snapshot.label}.json`),
    `${JSON.stringify(snapshot, null, 2)}\n`
  )
  return path
}

/**
 * Auto-generated readings of the numbers. Deliberately mechanical — they are
 * derived from the same snapshot the tables are, so the prose cannot drift
 * from the data the way a hand-written summary does.
 */
function observations(snapshot: Snapshot): string[] {
  const { results } = snapshot
  const out: string[] = []
  const n = results.length
  if (n === 0) return ['No scored queries — nothing to observe.']

  const flatFully = results.filter(r => r.flat?.fully).length
  const defFully = results.filter(r => r.groupedDefault?.fully).length
  const bestFully = results.filter(r => r.groupedBest?.fully).length

  if (snapshot.health.ok) {
    out.push(
      `Fully correct top-1: flat ${flatFully}/${n}, grouped default ${defFully}/${n}, ` +
        `grouped best variant ${bestFully}/${n}.`
    )
    const groupingGain = results.filter(r => !r.flat?.part && r.groupedDefault?.part).length
    if (groupingGain > 0) {
      out.push(
        `Grouping alone fixed the part on ${groupingGain} of ${n} quer${n === 1 ? 'y' : 'ies'} ` +
          '(flat returned an implausible cut/organ where the top group was right) — ' +
          'that gain is available today by routing search through ' +
          '`search_canonical_ingredients`.'
      )
    }
    const cooked = results.filter(r => r.expectedPrep === 'cooked' && r.groupedDefault)
    const rawDefaults = cooked.filter(r => r.groupedDefault?.topPrep === 'raw').length
    if (cooked.length > 0) {
      out.push(
        `The grouped default was **raw** on ${rawDefaults} of ${cooked.length} ` +
          'cooked-expected cases — `pickDefault` in scripts/026 awards +100 to ' +
          '`preparation_state = raw`, and nothing in either ranking path is ' +
          'context-aware about prep.'
      )
    }
    const defaultingOnly = results.filter(
      r => !r.groupedDefault?.fully && r.groupedBest?.fully
    ).length
    if (defaultingOnly > 0) {
      out.push(
        `${defaultingOnly} of ${n} cases would already be correct if the group's ` +
          'default variant were chosen differently — the grouping is right, the ' +
          'representative is not. That is a `pickDefault` change, not a search change.'
      )
    }
    const dataGap = results.filter(r => r.groupedDefault?.withinReach && !r.groupedBest?.fully)
    if (dataGap.length > 0) {
      out.push(
        `${dataGap.length} case(s) have NO fully-correct variant anywhere in the ` +
          `correct group (${dataGap.map(r => `\`${r.query}\``).join(', ')}) — a corpus ` +
          'gap, which no ranking change can fix.'
      )
    }
  } else {
    out.push(
      `Grouped side did not run (${snapshot.health.status}); flat scored ` +
        `${flatFully}/${n} fully correct. Re-run once the canonical layer is live ` +
        'to get the comparison this script exists for.'
    )
  }

  const noMatch = results.filter(r => !r.autoMatchFired).length
  if (noMatch > 0) {
    out.push(
      `${noMatch} of ${n} queries would NOT auto-match in the bowl flow ` +
        `(top-1 below MATCH_THRESHOLD ${MATCH_THRESHOLD}, or flagged unsafe) — ` +
        'the owner sees "no match" and picks manually.'
    )
  }
  const wrongAndConfident = results.filter(r => r.autoMatchFired && r.flat && !r.flat.fully)
  if (wrongAndConfident.length > 0) {
    out.push(
      `${wrongAndConfident.length} of ${n} auto-matched to a row that is NOT fully ` +
        'correct — the bowl flow commits these silently, which is the failure mode ' +
        'the owner actually experiences.'
    )
  }
  return out
}

// ---------------------------------------------------------------------------
// Compare
// ---------------------------------------------------------------------------

function loadSnapshot(label: string): Snapshot {
  const path = auditPath(`search-eval-${label}.json`)
  if (!existsSync(path)) {
    console.error(
      `No snapshot at ${path}. Run: npx tsx scripts/028_search_eval.ts --label ${label}`
    )
    process.exit(1)
  }
  return JSON.parse(readFileSync(path, 'utf8')) as Snapshot
}

/** Pure file-to-file diff — deliberately no database, so it is reproducible. */
function compareSnapshots(labelA: string, labelB: string): void {
  const a = loadSnapshot(labelA)
  const b = loadSnapshot(labelB)
  const lines: string[] = []

  lines.push(`# Search evaluation — \`${labelA}\` → \`${labelB}\``)
  lines.push('')
  lines.push(`- \`${labelA}\`: ${a.generatedAt}, canonical layer ${a.health.status}`)
  lines.push(`- \`${labelB}\`: ${b.generatedAt}, canonical layer ${b.health.status}`)
  lines.push('')

  const sides: Array<[string, (r: QueryResult) => SideResult | null]> = [
    ['flat', r => r.flat],
    ['grouped default', r => r.groupedDefault],
    ['grouped best variant', r => r.groupedBest],
  ]

  lines.push('## Metric deltas')
  lines.push('')
  lines.push('| side | metric | ' + `${labelA} | ${labelB} |`)
  lines.push('|---|---|---:|---:|')
  for (const [sideName, pick] of sides) {
    for (const [metric, predicate] of METRIC_ROWS) {
      lines.push(
        `| ${sideName} | ${metric} | ${tally(a.results, pick, predicate)} | ` +
          `${tally(b.results, pick, predicate)} |`
      )
    }
  }
  lines.push('')

  lines.push('## Per-case flips')
  lines.push('')
  const byQuery = new Map(b.results.map(r => [r.query, r]))
  const flips: string[] = []
  for (const before of a.results) {
    const after = byQuery.get(before.query)
    if (!after) {
      flips.push(`| \`${before.query}\` | _(all)_ | present | **absent** |`)
      continue
    }
    for (const [sideName, pick] of sides) {
      const x = pick(before)
      const y = pick(after)
      const xf = x ? glyph(x.fully) : 'n/a'
      const yf = y ? glyph(y.fully) : 'n/a'
      if (xf !== yf) flips.push(`| \`${before.query}\` | ${sideName} | ${xf} | ${yf} |`)
      else if (x && y && x.topName !== y.topName) {
        flips.push(
          `| \`${before.query}\` | ${sideName} (${yf}, same verdict) | ${x.topName} | ${y.topName} |`
        )
      }
    }
  }
  if (flips.length === 0) {
    lines.push('No per-case changes — every query returned the same verdict and the same top hit.')
  } else {
    lines.push(`| query | side | ${labelA} | ${labelB} |`)
    lines.push('|---|---|---|---|')
    lines.push(...flips)
  }
  lines.push('')

  const path = auditPath(`search-eval-compare-${labelA}-vs-${labelB}.md`)
  writeFileSync(path, `${lines.join('\n')}\n`)
  console.error(lines.join('\n'))
  console.error(`\nWrote ${path}`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.error(`=== Search eval: ${LABEL} ===`)

  const health = await checkCanonicalHealth()
  console.error(`  canonical layer: ${health.status} — ${health.detail}`)

  const fixture = await loadOrCaptureLabels()

  // Photo cases run the MODEL'S OWN label as the query, not the tidy canonical
  // query — that is what matchLocalIngredient receives in production, and
  // label phrasing is itself part of what is being measured.
  const plan: Array<{
    query: string
    case: EvalCase
    source: 'photo' | 'static'
    visionLabel: string | null
    observedPrep?: 'raw' | 'cooked' | null
  }> = []
  const unannotated: string[] = []

  for (const item of fixture?.items ?? []) {
    const c = findCaseForLabel(item.label)
    if (!c) {
      unannotated.push(item.label)
      continue
    }
    plan.push({
      query: item.label,
      case: c,
      source: 'photo',
      visionLabel: item.label,
      observedPrep: item.preparation_state ?? null,
    })
  }
  for (const c of STATIC_CASES) {
    plan.push({ query: c.query, case: c, source: 'static', visionLabel: null })
  }

  const results: QueryResult[] = []
  for (const entry of plan) {
    const flat = await evalFlat(entry.query, entry.case, entry.observedPrep)
    const grouped = health.ok
      ? await evalGrouped(entry.query, entry.case)
      : { def: null, best: null, rows: [] as GroupRow[] }

    results.push({
      query: entry.query,
      source: entry.source,
      visionLabel: entry.visionLabel,
      why: entry.case.why,
      expectedPrep: entry.case.expectedPrep,
      flat: flat.side,
      autoMatchFired: flat.autoMatchFired,
      groupedDefault: grouped.def,
      groupedBest: grouped.best,
    })

    const f = flat.side
    console.error(
      `  ${entry.source.padEnd(6)} ${JSON.stringify(entry.query).padEnd(24)} ` +
        `flat=${f ? `${glyph(f.base)}/${glyph(f.part)}/${glyph(f.prep)}` : 'none'} ` +
        `grouped=${grouped.def ? `${glyph(grouped.def.base)}/${glyph(grouped.def.part)}/${glyph(grouped.def.prep)}` : 'n/a'}`
    )
    if (VERBOSE) {
      console.error(`         flat top-${flat.rows.length}:`)
      for (const r of flat.rows) {
        console.error(`           ${r.similarity.toFixed(3)}  ${r.name.slice(0, 70)}`)
      }
      if (grouped.rows.length > 0) {
        console.error(`         grouped top-${grouped.rows.length}:`)
        for (const g of grouped.rows) {
          console.error(
            `           ${g.similarity.toFixed(3)}  ${g.display_name} (${g.variant_count}) -> ${g.name.slice(0, 50)}`
          )
        }
      }
    }
  }

  const snapshot: Snapshot = {
    label: LABEL,
    generatedAt: new Date().toISOString(),
    health,
    corpus: {
      activeFoods: await count('foods', 'active'),
      canonicalGroups: health.groups,
      attachedFoods: health.attachedFoods,
    },
    fixture,
    unannotated,
    results,
  }

  const path = writeReport(snapshot)
  console.error('')
  for (const o of observations(snapshot)) console.error(`  * ${o}`)
  console.error(`\nWrote ${path}`)
  process.exit(health.ok ? 0 : 2)
}

// ---------------------------------------------------------------------------
// Entry point. Must stay at the bottom: `compareSnapshots` closes over
// METRIC_ROWS, so dispatching any earlier hits the temporal dead zone.
// ---------------------------------------------------------------------------

if (COMPARE) {
  compareSnapshots(COMPARE[0], COMPARE[1])
} else {
  main().catch(err => {
    console.error('Fatal:', err)
    process.exit(1)
  })
}
