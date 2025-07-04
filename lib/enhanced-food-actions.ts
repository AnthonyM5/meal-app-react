'use server'

import { createClient } from '@/lib/supabase/server'
import type { Database, Food } from '@/lib/types'
import { importUSDAFood, searchUSDAFoods } from '@/lib/usda-api'
import type { SupabaseClient } from '@supabase/supabase-js'

interface EnhancedSearchResult {
  localFoods: Food[]
  usdaFoods: Array<{
    fdcId: number
    description: string
    brandOwner?: string
    brandName?: string
    servingSize?: number
    servingSizeUnit?: string
    calories?: number
    protein?: number
    carbs?: number
    fat?: number
  }>
}

export async function enhancedFoodSearch(
  query: string
): Promise<EnhancedSearchResult> {
  if (!query || query.length < 2) {
    return { localFoods: [], usdaFoods: [] }
  }

  // Search local database first
  const client = await createClient()
  if (!('from' in client)) {
    return { localFoods: [], usdaFoods: [] }
  }
  const supabase = client as SupabaseClient<Database>

  const { data: localFoods, error: _error } = await supabase
    .from('foods')
    .select('*')
    .ilike('name', `%${query}%`)
    .limit(10)
    .order('is_verified', { ascending: false })
    .order('name')

  // Search USDA database
  const usdaResults = await searchUSDAFoods(query, 10)

  // Process USDA results to extract basic nutrition info
  const usdaFoods = usdaResults.map(food => {
    const nutrients = food.foodNutrients || []

    return {
      fdcId: food.fdcId,
      description: food.description,
      brandOwner: food.brandOwner,
      brandName: food.brandName,
      servingSize: food.servingSize,
      servingSizeUnit: food.servingSizeUnit,
      calories: nutrients.find(n => n.nutrientId === 1008)?.value || 0,
      protein: nutrients.find(n => n.nutrientId === 1003)?.value || 0,
      carbs: nutrients.find(n => n.nutrientId === 1005)?.value || 0,
      fat: nutrients.find(n => n.nutrientId === 1004)?.value || 0,
    }
  })

  return {
    localFoods: localFoods || [],
    usdaFoods,
  }
}

export async function addUSDAFoodToMeal(
  fdcId: number,
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
  _quantity = 1,
  _date: string = new Date().toISOString().split('T')[0]
) {
  // First import the food to our database
  await importUSDAFood(fdcId)

  // Find the imported food
  const client = await createClient()
  if (!('from' in client)) {
    throw new Error('Failed to initialize database client')
  }
  const supabase = client as SupabaseClient<Database>

  const { data: foods } = await supabase
    .from('foods')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)

  if (!foods || foods.length === 0) {
    throw new Error('Failed to import food')
  }

  const importedFood = foods[0]

  // Use existing addFoodToMeal function
  const { addFoodToMeal } = await import('@/lib/food-actions')
  return await addFoodToMeal(importedFood.id, mealType)
}
