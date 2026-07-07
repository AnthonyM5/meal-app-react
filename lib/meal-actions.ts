'use server'

import {
  computeGaps,
  computeMealNutrients,
  computeTargets,
  energyInputsFromDog,
  findUnsafeIngredients,
  type MealItemInput,
  type NutrientGap,
  type NutrientKey,
} from '@/lib/canine-nutrition'
import { createClient } from '@/lib/supabase/server'
import type {
  Database,
  Dog,
  Ingredient,
  MealSource,
  MealType,
  NutrientRequirement,
} from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

type DummyClient = {
  auth: {
    getUser: () => Promise<{ data: { user: null }; error: null }>
    getSession: () => Promise<{ data: { session: null }; error: null }>
  }
}

function isDummyClient(
  client: SupabaseClient<Database> | DummyClient
): client is DummyClient {
  return !('from' in client)
}

async function getClient() {
  const client = await createClient()
  if (isDummyClient(client)) {
    throw new Error('Database client not properly initialized')
  }
  return client as SupabaseClient<Database>
}

async function getAuthenticatedClientOrRedirect() {
  const supabase = await getClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/auth/login')
  }

  return { supabase, user }
}

async function isGuestMode(): Promise<boolean> {
  const client = await getClient()
  const {
    data: { session },
  } = await client.auth.getSession()

  if (session) return false

  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  return cookieStore.get('guestMode')?.value === 'true'
}

export interface DogMealItemInput {
  ingredient_id: string
  grams: number
}

export interface DogMealResult {
  mealId: string
  dailyKcal: number
  mealKcal: number
  gaps: Partial<Record<NutrientKey, NutrientGap>>
  /** Ingredients flagged is_safe_for_dogs = false — always surface these */
  unsafeIngredients: Array<{ id: string; name: string; toxicity_note: string | null }>
  /** Non-empty health_conditions → the UI must show a consult-your-vet notice */
  requiresVetNotice: boolean
}

async function loadIngredients(
  supabase: SupabaseClient<Database>,
  items: DogMealItemInput[]
): Promise<MealItemInput[]> {
  const ids = items.map(i => i.ingredient_id)
  const { data, error } = await supabase.from('foods').select('*').in('id', ids)
  if (error) throw error

  const byId = new Map((data || []).map(f => [f.id, f as Ingredient]))
  return items.map(item => {
    const ingredient = byId.get(item.ingredient_id)
    if (!ingredient) {
      throw new Error(`Ingredient not found: ${item.ingredient_id}`)
    }
    if (item.grams <= 0) throw new Error('Item grams must be greater than 0')
    return { grams: item.grams, ingredient }
  })
}

async function loadRequirements(
  supabase: SupabaseClient<Database>
): Promise<NutrientRequirement[]> {
  const { data, error } = await supabase.from('nutrient_requirements').select('*')
  if (error) throw error
  return (data || []) as NutrientRequirement[]
}

/**
 * Create a meal for a dog and return the computed nutrient gaps.
 * All math happens in lib/canine-nutrition.ts — deterministic, no AI.
 */
export async function createDogMeal(
  dogId: string,
  mealType: MealType,
  items: DogMealItemInput[],
  options: { source?: MealSource; name?: string; date?: string } = {}
): Promise<DogMealResult> {
  if (await isGuestMode()) {
    throw new Error('Please sign in to log meals')
  }

  if (!items || items.length === 0) {
    throw new Error('Meal must have at least one ingredient')
  }

  const { supabase, user } = await getAuthenticatedClientOrRedirect()

  // Verify dog ownership
  const { data: dog, error: dogError } = await supabase
    .from('dogs')
    .select('*')
    .eq('id', dogId)
    .single()

  if (dogError) throw dogError
  if (!dog) throw new Error('Dog not found')
  if ((dog as Dog).owner_id !== user.id) throw new Error('Unauthorized')

  const mealItems = await loadIngredients(supabase, items)
  const totals = computeMealNutrients(mealItems)

  const date = options.date ?? new Date().toISOString().split('T')[0]

  const { data: meal, error: mealError } = await supabase
    .from('meals')
    .insert({
      user_id: user.id,
      dog_id: dogId,
      meal_type: mealType,
      source: options.source ?? 'manual',
      date,
      name: options.name ?? null,
    })
    .select()
    .single()

  if (mealError) throw mealError
  if (!meal) throw new Error('Failed to create meal')

  const itemsToInsert = mealItems.map(({ grams, ingredient }) => {
    const scale = grams / (Number(ingredient.serving_size) || 100)
    return {
      meal_id: meal.id,
      food_id: ingredient.id,
      quantity: grams,
      unit: 'g',
      serving_multiplier: scale,
      calories: Number(ingredient.calories_per_serving || 0) * scale,
      protein_g: Number(ingredient.protein_g || 0) * scale,
      carbs_g: Number(ingredient.carbs_g || 0) * scale,
      fat_g: Number(ingredient.fat_g || 0) * scale,
      fiber_g: Number(ingredient.fiber_g || 0) * scale,
    }
  })

  const { error: itemsError } = await supabase
    .from('meal_items')
    .insert(itemsToInsert)

  if (itemsError) {
    // Rollback the meal shell if items failed
    await supabase.from('meals').delete().eq('id', meal.id)
    throw itemsError
  }

  const requirements = await loadRequirements(supabase)
  const dogTargets = computeTargets(energyInputsFromDog(dog as Dog), requirements)
  const gaps = computeGaps(totals, dogTargets)

  revalidatePath('/dashboard')

  return {
    mealId: meal.id,
    dailyKcal: dogTargets.dailyKcal,
    mealKcal: totals.calories,
    gaps,
    unsafeIngredients: findUnsafeIngredients(mealItems).map(ing => ({
      id: ing.id,
      name: ing.name,
      toxicity_note: ing.toxicity_note ?? null,
    })),
    requiresVetNotice: ((dog as Dog).health_conditions?.length ?? 0) > 0,
  }
}

/**
 * Recompute a dog's full-day nutrient gaps from everything logged on a date.
 */
export async function getDogDailyGaps(
  dogId: string,
  date?: string
): Promise<Omit<DogMealResult, 'mealId' | 'mealKcal'> & { totalKcal: number }> {
  const { supabase, user } = await getAuthenticatedClientOrRedirect()

  const { data: dog, error: dogError } = await supabase
    .from('dogs')
    .select('*')
    .eq('id', dogId)
    .single()

  if (dogError) throw dogError
  if (!dog) throw new Error('Dog not found')
  if ((dog as Dog).owner_id !== user.id) throw new Error('Unauthorized')

  const targetDate = date ?? new Date().toISOString().split('T')[0]

  const { data: meals, error: mealsError } = await supabase
    .from('meals')
    .select('id, meal_items ( quantity, food:foods (*) )')
    .eq('dog_id', dogId)
    .eq('date', targetDate)

  if (mealsError) throw mealsError

  const mealItems: MealItemInput[] = []
  // Supabase's nested-select typing can't express the joined shape here
  for (const meal of (meals || []) as unknown as Array<{
    meal_items?: Array<{ quantity: number; food: Ingredient | null }>
  }>) {
    for (const item of meal.meal_items || []) {
      if (item.food) {
        mealItems.push({ grams: Number(item.quantity), ingredient: item.food })
      }
    }
  }

  const totals = computeMealNutrients(mealItems)
  const requirements = await loadRequirements(supabase)
  const dogTargets = computeTargets(energyInputsFromDog(dog as Dog), requirements)

  return {
    dailyKcal: dogTargets.dailyKcal,
    totalKcal: totals.calories,
    gaps: computeGaps(totals, dogTargets),
    unsafeIngredients: findUnsafeIngredients(mealItems).map(ing => ({
      id: ing.id,
      name: ing.name,
      toxicity_note: ing.toxicity_note ?? null,
    })),
    requiresVetNotice: ((dog as Dog).health_conditions?.length ?? 0) > 0,
  }
}

export async function deleteDogMeal(mealId: string): Promise<void> {
  if (await isGuestMode()) {
    throw new Error('Please sign in to delete meals')
  }

  const { supabase, user } = await getAuthenticatedClientOrRedirect()

  const { data: meal, error: fetchError } = await supabase
    .from('meals')
    .select('user_id')
    .eq('id', mealId)
    .single()

  if (fetchError) throw fetchError
  if (!meal) throw new Error('Meal not found')
  if (meal.user_id !== user.id) throw new Error('Unauthorized')

  const { error } = await supabase.from('meals').delete().eq('id', mealId)
  if (error) throw error

  revalidatePath('/dashboard')
}
