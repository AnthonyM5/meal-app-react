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
import type {
  Database,
  Dog,
  Ingredient,
  MealSource,
  MealType,
  NutrientRequirement,
} from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Dog-meal business logic, shared by the Server Actions (lib/meal-actions.ts)
 * and future REST routes for the mobile app. No Next.js imports allowed here
 * — auth resolution, guest-mode checks, and revalidation belong to callers.
 * All nutrition math stays in lib/canine-nutrition.ts — deterministic, no AI.
 */

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

function toMealItemRows(mealId: string, mealItems: MealItemInput[]) {
  return mealItems.map(({ grams, ingredient }) => {
    const scale = grams / (Number(ingredient.serving_size) || 100)
    return {
      meal_id: mealId,
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
}

function mealResultExtras(dog: Dog, mealItems: MealItemInput[]) {
  return {
    unsafeIngredients: findUnsafeIngredients(mealItems).map(ing => ({
      id: ing.id,
      name: ing.name,
      toxicity_note: ing.toxicity_note ?? null,
    })),
    requiresVetNotice: (dog.health_conditions?.length ?? 0) > 0,
  }
}

/**
 * Create a meal for a dog and return the computed nutrient gaps.
 */
export async function createDogMeal(
  supabase: SupabaseClient<Database>,
  userId: string,
  dogId: string,
  mealType: MealType,
  items: DogMealItemInput[],
  options: { source?: MealSource; name?: string; date?: string } = {}
): Promise<DogMealResult> {
  if (!items || items.length === 0) {
    throw new Error('Meal must have at least one ingredient')
  }

  // Verify dog ownership. maybeSingle, not single: zero rows (nonexistent
  // dogId) is an expected "not found" outcome, not a query error — single()
  // would throw a raw Postgrest "no rows" error before reaching the check
  // below and never produce the friendly 'Dog not found' message.
  const { data: dog, error: dogError } = await supabase
    .from('dogs')
    .select('*')
    .eq('id', dogId)
    .maybeSingle()

  if (dogError) throw dogError
  if (!dog) throw new Error('Dog not found')
  // Foreign dog → 'not found' (404), not 403: don't confirm the id exists to
  // a non-owner, and keep every ownership check in this layer on one status.
  if ((dog as Dog).owner_id !== userId) throw new Error('Dog not found')

  const mealItems = await loadIngredients(supabase, items)
  const { totals, coverage } = computeMealNutrients(mealItems)

  const date = options.date ?? new Date().toISOString().split('T')[0]

  const { data: meal, error: mealError } = await supabase
    .from('meals')
    .insert({
      user_id: userId,
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

  const { error: itemsError } = await supabase
    .from('meal_items')
    .insert(toMealItemRows(meal.id, mealItems))

  if (itemsError) {
    // Rollback the meal shell if items failed
    await supabase.from('meals').delete().eq('id', meal.id)
    throw itemsError
  }

  const requirements = await loadRequirements(supabase)
  const dogTargets = computeTargets(energyInputsFromDog(dog as Dog), requirements)
  const gaps = computeGaps(totals, dogTargets, coverage)

  return {
    mealId: meal.id,
    dailyKcal: dogTargets.dailyKcal,
    mealKcal: totals.calories,
    gaps,
    ...mealResultExtras(dog as Dog, mealItems),
  }
}

export interface DogMealForEdit {
  id: string
  dogId: string
  mealType: MealType
  name: string | null
  date: string
  items: Array<{ grams: number; food: Ingredient }>
}

/**
 * Load a meal's items (with full ingredient data, for prefilling the meal
 * builder) for editing. Ownership is checked via the dog join.
 */
export async function getDogMealForEdit(
  supabase: SupabaseClient<Database>,
  userId: string,
  mealId: string
): Promise<DogMealForEdit> {
  // maybeSingle: see the ownership-check comment in createDogMeal above.
  const { data: meal, error } = await supabase
    .from('meals')
    .select(
      'id, dog_id, meal_type, name, date, dogs!inner ( owner_id ), meal_items ( quantity, food:foods (*) )'
    )
    .eq('id', mealId)
    .maybeSingle()

  if (error) throw error
  if (!meal) throw new Error('Meal not found')

  // Supabase's nested-select typing can't express the joined shape here
  const typed = meal as unknown as {
    id: string
    dog_id: string | null
    meal_type: MealType
    name: string | null
    date: string
    dogs: { owner_id: string }
    meal_items?: Array<{ quantity: number; food: Ingredient | null }>
  }

  // Foreign meal → 'not found' (404), not 403 (see createDogMeal).
  if (typed.dogs.owner_id !== userId) throw new Error('Meal not found')
  if (!typed.dog_id) throw new Error('Meal has no associated dog')

  return {
    id: typed.id,
    dogId: typed.dog_id,
    mealType: typed.meal_type,
    name: typed.name,
    date: typed.date,
    items: (typed.meal_items || [])
      .filter(item => item.food)
      .map(item => ({ grams: Number(item.quantity), food: item.food! })),
  }
}

/**
 * Replace a meal's items/type and return refreshed gaps, same shape as
 * `createDogMeal`.
 */
export async function updateDogMeal(
  supabase: SupabaseClient<Database>,
  userId: string,
  mealId: string,
  mealType: MealType,
  items: DogMealItemInput[],
  options: { name?: string } = {}
): Promise<DogMealResult> {
  if (!items || items.length === 0) {
    throw new Error('Meal must have at least one ingredient')
  }

  // maybeSingle: see the ownership-check comment in createDogMeal above.
  const { data: meal, error: mealError } = await supabase
    .from('meals')
    .select('id, user_id, dog_id, dogs!inner ( * )')
    .eq('id', mealId)
    .maybeSingle()

  if (mealError) throw mealError
  if (!meal) throw new Error('Meal not found')

  // Supabase's nested-select typing can't express the joined shape here
  const typedMeal = meal as unknown as {
    user_id: string
    dog_id: string | null
    dogs: Dog
  }
  // Foreign meal → 'not found' (404), not 403 (see createDogMeal).
  if (typedMeal.user_id !== userId) throw new Error('Meal not found')
  if (!typedMeal.dog_id) throw new Error('Meal has no associated dog')

  const dog = typedMeal.dogs
  const mealItems = await loadIngredients(supabase, items)
  const { totals, coverage } = computeMealNutrients(mealItems)

  // Keep the old items so a failed insert can be rolled back instead of
  // leaving the meal with no items.
  const { data: oldItems, error: oldItemsError } = await supabase
    .from('meal_items')
    .select('*')
    .eq('meal_id', mealId)
  if (oldItemsError) throw oldItemsError

  const { error: deleteError } = await supabase
    .from('meal_items')
    .delete()
    .eq('meal_id', mealId)
  if (deleteError) throw deleteError

  const { error: insertError } = await supabase
    .from('meal_items')
    .insert(toMealItemRows(mealId, mealItems))

  if (insertError) {
    if (oldItems && oldItems.length > 0) {
      await supabase
        .from('meal_items')
        .insert(oldItems.map(({ id: _id, ...rest }) => rest))
    }
    throw insertError
  }

  const { error: updateError } = await supabase
    .from('meals')
    .update({
      meal_type: mealType,
      ...(options.name !== undefined && { name: options.name || null }),
    })
    .eq('id', mealId)
  if (updateError) throw updateError

  const requirements = await loadRequirements(supabase)
  const dogTargets = computeTargets(energyInputsFromDog(dog), requirements)
  const gaps = computeGaps(totals, dogTargets, coverage)

  return {
    mealId,
    dailyKcal: dogTargets.dailyKcal,
    mealKcal: totals.calories,
    gaps,
    ...mealResultExtras(dog, mealItems),
  }
}

/**
 * Recompute a dog's full-day nutrient gaps from everything logged on a date.
 */
export async function getDogDailyGaps(
  supabase: SupabaseClient<Database>,
  userId: string,
  dogId: string,
  date?: string
): Promise<Omit<DogMealResult, 'mealId' | 'mealKcal'> & { totalKcal: number }> {
  // maybeSingle: see the ownership-check comment in createDogMeal above.
  const { data: dog, error: dogError } = await supabase
    .from('dogs')
    .select('*')
    .eq('id', dogId)
    .maybeSingle()

  if (dogError) throw dogError
  if (!dog) throw new Error('Dog not found')
  // Foreign dog → 'not found' (404), not 403 (see createDogMeal).
  if ((dog as Dog).owner_id !== userId) throw new Error('Dog not found')

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

  const { totals, coverage } = computeMealNutrients(mealItems)
  const requirements = await loadRequirements(supabase)
  const dogTargets = computeTargets(energyInputsFromDog(dog as Dog), requirements)

  return {
    dailyKcal: dogTargets.dailyKcal,
    totalKcal: totals.calories,
    gaps: computeGaps(totals, dogTargets, coverage),
    ...mealResultExtras(dog as Dog, mealItems),
  }
}

export interface DogMealSummary {
  id: string
  meal_type: MealType
  name: string | null
  calories: number
  items: Array<{ name: string; grams: number }>
}

/**
 * List a dog's meals for a date (defaults to today) for display/deletion.
 */
export async function getDogMeals(
  supabase: SupabaseClient<Database>,
  userId: string,
  dogId: string,
  date?: string
): Promise<DogMealSummary[]> {
  // maybeSingle: see the ownership-check comment in createDogMeal above.
  const { data: dog, error: dogError } = await supabase
    .from('dogs')
    .select('owner_id')
    .eq('id', dogId)
    .maybeSingle()

  if (dogError) throw dogError
  // Foreign or missing dog → 'not found' (404), not 403 (see createDogMeal).
  if (!dog || dog.owner_id !== userId) throw new Error('Dog not found')

  const targetDate = date ?? new Date().toISOString().split('T')[0]

  const { data: meals, error } = await supabase
    .from('meals')
    .select('id, meal_type, name, created_at, meal_items ( quantity, calories, food:foods ( name ) )')
    .eq('dog_id', dogId)
    .eq('date', targetDate)
    .order('created_at', { ascending: true })

  if (error) throw error

  // Supabase's nested-select typing can't express the joined shape here
  return ((meals || []) as unknown as Array<{
    id: string
    meal_type: MealType
    name: string | null
    meal_items?: Array<{
      quantity: number
      calories: number | null
      food: { name: string } | null
    }>
  }>).map(meal => ({
    id: meal.id,
    meal_type: meal.meal_type,
    name: meal.name,
    calories: (meal.meal_items || []).reduce(
      (sum, item) => sum + Number(item.calories || 0),
      0
    ),
    items: (meal.meal_items || []).map(item => ({
      name: item.food?.name ?? 'Unknown ingredient',
      grams: Number(item.quantity),
    })),
  }))
}

export async function deleteDogMeal(
  supabase: SupabaseClient<Database>,
  userId: string,
  mealId: string
): Promise<void> {
  // maybeSingle: see the ownership-check comment in createDogMeal above.
  const { data: meal, error: fetchError } = await supabase
    .from('meals')
    .select('user_id')
    .eq('id', mealId)
    .maybeSingle()

  if (fetchError) throw fetchError
  if (!meal) throw new Error('Meal not found')
  // Foreign meal → 'not found' (404), not 403 (see createDogMeal).
  if (meal.user_id !== userId) throw new Error('Meal not found')

  const { error } = await supabase.from('meals').delete().eq('id', mealId)
  if (error) throw error
}
