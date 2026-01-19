'use server'

import { createClient } from '@/lib/supabase/server'
import type { Database, MealType, Recipe } from '@/lib/types'
import { calculateRecipeNutrition } from '@/lib/recipe-utils'
import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// Re-export for consumers
export { calculateRecipeNutrition } from '@/lib/recipe-utils'
export type { RecipeNutrition } from '@/lib/recipe-utils'

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

export async function createRecipe(
  name: string,
  description: string,
  ingredients: Array<{ food_id: string; quantity: number; unit: string }>,
  servings: number = 1,
  isPublic: boolean = false
): Promise<Recipe> {
  if (await isGuestMode()) {
    throw new Error('Please sign in to create recipes')
  }

  if (!name || name.trim().length === 0) {
    throw new Error('Recipe name is required')
  }

  if (!ingredients || ingredients.length === 0) {
    throw new Error('Recipe must have at least one ingredient')
  }

  if (servings <= 0) {
    throw new Error('Servings must be greater than 0')
  }

  const { supabase, user } = await getAuthenticatedClientOrRedirect()

  // Insert recipe
  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      created_by: user.id,
      servings,
      is_public: isPublic,
    })
    .select()
    .single()

  if (recipeError) throw recipeError
  if (!recipe) throw new Error('Failed to create recipe')

  // Insert ingredients
  const ingredientsToInsert = ingredients.map(ing => ({
    recipe_id: recipe.id,
    food_id: ing.food_id,
    quantity: ing.quantity,
    unit: ing.unit,
  }))

  const { error: ingredientsError } = await supabase
    .from('recipe_ingredients')
    .insert(ingredientsToInsert)

  if (ingredientsError) {
    // Rollback: delete the recipe if ingredients failed
    await supabase.from('recipes').delete().eq('id', recipe.id)
    throw ingredientsError
  }

  revalidatePath('/dashboard')
  revalidatePath('/recipes')
  return recipe
}

export async function getRecipeWithIngredients(recipeId: string): Promise<Recipe> {
  const supabase = await getClient()

  const { data, error } = await supabase
    .from('recipes')
    .select(`
      *,
      recipe_ingredients (
        *,
        food:foods (*)
      )
    `)
    .eq('id', recipeId)
    .single()

  if (error) throw error
  if (!data) throw new Error('Recipe not found')

  return data as Recipe
}

export async function searchRecipes(
  query: string,
  publicOnly: boolean = false
): Promise<Recipe[]> {
  if (!query || query.length < 2) return []

  const supabase = await getClient()

  let queryBuilder = supabase
    .from('recipes')
    .select('*')
    .ilike('name', `%${query}%`)

  if (publicOnly) {
    queryBuilder = queryBuilder.eq('is_public', true)
  }

  const { data, error } = await queryBuilder.limit(20)

  if (error) throw error
  return data || []
}

export async function getUserRecipes(): Promise<Recipe[]> {
  const { supabase, user } = await getAuthenticatedClientOrRedirect()

  const { data, error } = await supabase
    .from('recipes')
    .select(`
      *,
      recipe_ingredients (
        *,
        food:foods (*)
      )
    `)
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []) as Recipe[]
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  if (await isGuestMode()) {
    throw new Error('Please sign in to delete recipes')
  }

  const { supabase, user } = await getAuthenticatedClientOrRedirect()

  // Verify ownership
  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .select('created_by')
    .eq('id', recipeId)
    .single()

  if (recipeError) throw recipeError
  if (!recipe) throw new Error('Recipe not found')
  if (recipe.created_by !== user.id) throw new Error('Unauthorized')

  // Delete the recipe (ingredients will cascade delete)
  const { error: deleteError } = await supabase
    .from('recipes')
    .delete()
    .eq('id', recipeId)

  if (deleteError) throw deleteError

  revalidatePath('/dashboard')
  revalidatePath('/recipes')
}

export async function updateRecipe(
  recipeId: string,
  updates: {
    name?: string
    description?: string
    servings?: number
    is_public?: boolean
  }
): Promise<Recipe> {
  if (await isGuestMode()) {
    throw new Error('Please sign in to update recipes')
  }

  const { supabase, user } = await getAuthenticatedClientOrRedirect()

  // Verify ownership
  const { data: existingRecipe, error: recipeError } = await supabase
    .from('recipes')
    .select('created_by')
    .eq('id', recipeId)
    .single()

  if (recipeError) throw recipeError
  if (!existingRecipe) throw new Error('Recipe not found')
  if (existingRecipe.created_by !== user.id) throw new Error('Unauthorized')

  // Validate updates
  if (updates.name !== undefined && updates.name.trim().length === 0) {
    throw new Error('Recipe name cannot be empty')
  }

  if (updates.servings !== undefined && updates.servings <= 0) {
    throw new Error('Servings must be greater than 0')
  }

  const { data, error } = await supabase
    .from('recipes')
    .update({
      ...(updates.name && { name: updates.name.trim() }),
      ...(updates.description !== undefined && { description: updates.description?.trim() || null }),
      ...(updates.servings !== undefined && { servings: updates.servings }),
      ...(updates.is_public !== undefined && { is_public: updates.is_public }),
    })
    .eq('id', recipeId)
    .select()
    .single()

  if (error) throw error
  if (!data) throw new Error('Failed to update recipe')

  revalidatePath('/dashboard')
  revalidatePath('/recipes')
  return data
}

export async function addRecipeToMeal(
  recipeId: string,
  mealType: MealType,
  servingMultiplier: number = 1
): Promise<void> {
  if (await isGuestMode()) {
    throw new Error('Please sign in to add recipes to meals')
  }

  if (servingMultiplier <= 0) {
    throw new Error('Serving multiplier must be greater than 0')
  }

  const { supabase, user } = await getAuthenticatedClientOrRedirect()

  const today = new Date().toISOString().split('T')[0]

  // Get recipe with ingredients
  const recipe = await getRecipeWithIngredients(recipeId)

  // Calculate total nutrition for the recipe
  const totalNutrition = calculateRecipeNutrition(recipe, servingMultiplier)

  // Find or create meal for today
  const { data: existingMeal, error: mealFetchError } = await supabase
    .from('meals')
    .select('*')
    .eq('user_id', user.id)
    .eq('meal_type', mealType)
    .eq('date', today)
    .single()

  let meal = existingMeal

  if (mealFetchError && mealFetchError.code === 'PGRST116') {
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
    meal = newMeal
  } else if (mealFetchError) {
    throw mealFetchError
  }

  if (!meal) throw new Error('Failed to get or create meal')

  // Add recipe as meal item
  const { error } = await supabase.from('meal_items').insert({
    meal_id: meal.id,
    recipe_id: recipeId,
    quantity: 1,
    unit: 'serving',
    serving_multiplier: servingMultiplier,
    ...totalNutrition,
  })

  if (error) throw error
  revalidatePath('/dashboard')
}
