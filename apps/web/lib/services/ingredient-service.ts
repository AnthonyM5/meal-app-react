import { checkDogSafety } from '@/lib/dog-toxic-foods'
import { parseFoodName } from '@/lib/food-name-parser'
import {
  convertOFFToIngredient,
  fetchOFFByBarcode,
} from '@/lib/off-integration'
import { storePayload } from '@/lib/source-payloads'
import type { Database, Food } from '@/lib/types'
import {
  createClient as createServiceClient,
  type SupabaseClient,
} from '@supabase/supabase-js'

/**
 * Ingredient-creation business logic, shared by the Server Actions
 * (lib/ingredient-actions.ts) and future REST routes for the mobile app.
 * No Next.js imports allowed here — auth resolution belongs to callers.
 */

/**
 * Attach a newly created food to the canonical layer by EXACT slug match.
 *
 * Rows created after a scripts/026 build used to stay canonical_id = NULL
 * until the next full rebuild — invisible to grouped search and, worse,
 * exempt from the bowl variant-choice safety gate. Exact match only: fuzzy
 * matching and canonical creation stay offline in scripts/026, where the
 * audit (scripts/027) can replay them. No match is fine — the row waits for
 * the next build. Best-effort by design (returns null on any error): failing
 * to attach must never block creating the ingredient.
 *
 * Known limit: attaching does not re-derive the group's pessimistic
 * is_safe_for_dogs rollup; a newly attached toxic variant is still flagged
 * row-level, and the group flag catches up on the next 026 run.
 */
async function lookupCanonicalId(
  supabase: SupabaseClient<Database>,
  name: string
): Promise<string | null> {
  try {
    const { slug } = parseFoodName(name)
    if (!slug) return null
    const { data } = await supabase
      .from('canonical_ingredients')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    return (data?.id as string | undefined) ?? null
  } catch {
    return null
  }
}

export interface ManualIngredientInput {
  name: string
  /** Per 100 g as fed. Required — a food with no energy value can't be logged. */
  calories_per_100g: number
  protein_g_per_100g?: number
  fat_g_per_100g?: number
  carbs_g_per_100g?: number
}

/**
 * Create an owner-entered ingredient (`source='manual'`) so a bowl item with
 * no USDA/OFF match can still be logged and counted toward the meal total
 * instead of being deleted. Macros beyond kcal are optional; everything
 * unknown stays null ("missing ≠ zero") and the row is marked sparse and
 * unverified so it never feeds micronutrient gap math.
 */
export async function createManualIngredient(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: ManualIngredientInput
): Promise<Food> {
  const name = input.name.trim()
  if (!name) throw new Error('Ingredient name is required')
  const kcal = Number(input.calories_per_100g)
  if (!Number.isFinite(kcal) || kcal < 0) {
    throw new Error('Calories per 100 g must be a non-negative number')
  }

  // Macros keep the schema's deliberate 0-default (they always participate
  // in meal math); only micronutrients follow the null="unknown" rule.
  const macro = (value: number | undefined) =>
    value != null && Number.isFinite(Number(value)) && Number(value) >= 0
      ? Number(value)
      : 0

  const safety = checkDogSafety(name)
  const canonicalId = await lookupCanonicalId(supabase, name)

  const { data, error } = await supabase
    .from('foods')
    .insert({
      name,
      canonical_id: canonicalId,
      serving_size: 100,
      serving_unit: 'g',
      calories_per_serving: kcal,
      protein_g: macro(input.protein_g_per_100g),
      fat_g: macro(input.fat_g_per_100g),
      carbs_g: macro(input.carbs_g_per_100g),
      fiber_g: 0,
      is_safe_for_dogs: safety.isSafe,
      toxicity_note: safety.note,
      is_verified: false,
      source: 'manual',
      data_completeness: 'sparse',
      created_by: userId,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as Food
}

/**
 * Cache-on-accept for an Open (Pet) Food Facts suggestion: the owner
 * confirmed the branded candidate, so fetch its canonical record, convert
 * it (macros only, micros null, ODbL attribution), and upsert into `foods`
 * keyed by barcode. Subsequent bowls resolve it locally with no OFF call.
 */
export async function acceptBrandedIngredient(
  supabase: SupabaseClient<Database>,
  code: string
): Promise<Food> {
  // Already cached? Reuse — barcode is unique.
  const { data: cached } = await supabase
    .from('foods')
    .select('*')
    .eq('barcode', code)
    .maybeSingle()
  if (cached) return cached as Food

  const product = await fetchOFFByBarcode(code)
  if (!product) throw new Error('Product no longer available on Open Food Facts')
  const row = convertOFFToIngredient(product)
  if (!row) throw new Error('Product reports no calorie data — log it as a custom ingredient instead')
  const canonicalId = await lookupCanonicalId(supabase, row.name)

  const { data, error } = await supabase
    .from('foods')
    // OFF rows carry null macros where unreported; the runtime schema allows
    // this (nullable columns) even though the legacy Insert type says number.
    .insert({
      ...row,
      canonical_id: canonicalId,
    } as unknown as Database['public']['Tables']['foods']['Insert'])
    .select('*')
    .single()
  if (error) throw error

  // Archive the raw payload (service role — source_payloads is not
  // writable by user sessions). Best-effort: never block the accept.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (serviceKey && url) {
    const service = createServiceClient<Database>(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    await storePayload(service, {
      source: 'off',
      kind: 'detail',
      externalId: code,
      payload: product,
      foodId: (data as Food).id,
    })
  }

  return data as Food
}
