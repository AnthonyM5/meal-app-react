'use server'

import { createClient } from '@/lib/supabase/server'
import type { Database, Food, Meal, MealType } from '@/lib/types'
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

export async function searchFoods(query: string): Promise<Food[]> {
  if (!query || query.length < 2) return []

  try {
    const supabase = await getClient()

    const { data, error } = await supabase
      .from('foods')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(20)
      .order('is_verified', { ascending: false })
      .order('name')

    if (error) {
      console.error('Error searching foods:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error in searchFoods:', error)
    return []
  }
}

export async function getTodaysMeals(): Promise<Meal[]> {
  try {
    const { supabase, user } = await getAuthenticatedClientOrRedirect()

    const today = new Date().toISOString().split('T')[0]

    const { data: meals, error } = await supabase
      .from('meals')
      .select(
        `
        *,
        meal_items (
          *,
          food:foods (*)
        )
      `
      )
      .eq('user_id', user.id)
      .eq('date', today)
      .order('created_at', { ascending: true })

    if (error) throw error
    return meals || []
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return []
    }
    throw error
  }
}

// Helper to check guest mode using cookies
async function isGuestMode(): Promise<boolean> {
  const client = await getClient()
  const {
    data: { session },
  } = await client.auth.getSession()

  // If authenticated, not in guest mode
  if (session) return false

  // Check guest mode cookie - matches middleware implementation
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  return cookieStore.get('guestMode')?.value === 'true'
}

export async function addFoodToMeal(
  foodId: string,
  mealType: MealType,
  quantity: number = 1,
  unit?: string
) {
  if (await isGuestMode()) {
    throw new Error('Please sign in to add foods to meals')
  }
  const { supabase, user } = await getAuthenticatedClientOrRedirect()
  const today = new Date().toISOString().split('T')[0]

  // Get the food details
  const { data: food, error: foodError } = await supabase
    .from('foods')
    .select('*')
    .eq('id', foodId)
    .single()

  if (foodError) throw foodError
  if (!food) throw new Error('Food not found')

  // Find or create meal for today
  const { data: meal, error: mealError } = await supabase
    .from('meals')
    .select('*')
    .eq('user_id', user.id)
    .eq('meal_type', mealType)
    .eq('date', today)
    .single()

  let finalMeal = meal

  if (mealError && mealError.code === 'PGRST116') {
    // Meal doesn't exist, create it
    const { data: newMeal, error: createError } = await supabase
      .from('meals')
      .insert({
        user_id: user.id,
        meal_type: mealType,
        date: today,
        name: mealType.charAt(0).toUpperCase() + mealType.slice(1),
      })
      .select()
      .single()

    if (createError) throw createError
    if (!newMeal) throw new Error('Failed to create meal')
    finalMeal = newMeal
  } else if (mealError) {
    throw mealError
  }

  // Calculate nutrition values based on quantity
  const calories = food.calories_per_serving * quantity
  const protein_g = food.protein_g * quantity
  const carbs_g = food.carbs_g * quantity
  const fat_g = food.fat_g * quantity
  const fiber_g = food.fiber_g * quantity

  // Add meal item
  const { error: itemError } = await supabase.from('meal_items').insert({
    meal_id: finalMeal.id,
    food_id: foodId,
    quantity,
    unit: unit || food.serving_unit,
    serving_multiplier: 1,
    calories,
    protein_g,
    carbs_g,
    fat_g,
    fiber_g,
  })

  if (itemError) throw itemError

  revalidatePath('/dashboard')
}

export async function updateMealItem(itemId: string, newQuantity: number) {
  const { supabase, user } = await getAuthenticatedClientOrRedirect()

  // Get the meal item with food details
  const { data: item, error: itemError } = await supabase
    .from('meal_items')
    .select('*, food:foods(*), meal:meals(user_id)')
    .eq('id', itemId)
    .single()

  if (itemError) throw itemError
  if (!item?.meal?.user_id) throw new Error('Meal item not found')
  if (item.meal.user_id !== user.id) throw new Error('Unauthorized')

  // For recipe-based items, the nutrition values need to be recalculated differently
  // For now, we only support updating food-based items
  if (!item.food) {
    throw new Error('Cannot update recipe-based meal items directly')
  }

  // Recalculate nutrition values
  const calories = item.food.calories_per_serving * newQuantity
  const protein_g = item.food.protein_g * newQuantity
  const carbs_g = item.food.carbs_g * newQuantity
  const fat_g = item.food.fat_g * newQuantity
  const fiber_g = item.food.fiber_g * newQuantity

  // Update the meal item
  const { error: updateError } = await supabase
    .from('meal_items')
    .update({
      quantity: newQuantity,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      fiber_g,
    })
    .eq('id', itemId)

  if (updateError) throw updateError

  revalidatePath('/dashboard')
}

export async function deleteMealItem(itemId: string) {
  const { supabase, user } = await getAuthenticatedClientOrRedirect()

  // Verify ownership
  const { data: item, error: itemError } = await supabase
    .from('meal_items')
    .select('*, meal:meals(user_id)')
    .eq('id', itemId)
    .single()

  if (itemError) throw itemError
  if (!item?.meal?.user_id) throw new Error('Meal item not found')
  if (item.meal.user_id !== user.id) throw new Error('Unauthorized')

  // Delete the meal item
  const { error: deleteError } = await supabase
    .from('meal_items')
    .delete()
    .eq('id', itemId)

  if (deleteError) throw deleteError

  revalidatePath('/dashboard')
}

export async function createMeal(type: MealType, date: string) {
  if (await isGuestMode()) {
    throw new Error('Please sign in to create meals')
  }
  const { supabase, user } = await getAuthenticatedClientOrRedirect()

  const { data, error } = await supabase
    .from('meals')
    .insert({
      user_id: user.id,
      meal_type: type,
      date,
      name: type.charAt(0).toUpperCase() + type.slice(1),
    })
    .select()
    .single()

  if (error) throw error

  return data
}

export async function deleteMeal(mealId: string) {
  if (await isGuestMode()) {
    throw new Error('Please sign in to delete meals')
  }
  const { supabase, user } = await getAuthenticatedClientOrRedirect()

  // Verify ownership
  const { data: meal, error: mealError } = await supabase
    .from('meals')
    .select('user_id')
    .eq('id', mealId)
    .single()

  if (mealError) throw mealError
  if (meal.user_id !== user.id) throw new Error('Unauthorized')

  // Delete the meal
  const { error: deleteError } = await supabase
    .from('meals')
    .delete()
    .eq('id', mealId)

  if (deleteError) throw deleteError

  revalidatePath('/dashboard')
}
