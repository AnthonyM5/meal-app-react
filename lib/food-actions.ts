"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { Food, Meal, MealType } from "@/lib/types"

export async function searchFoods(query: string): Promise<Food[]> {
  if (!query || query.length < 2) return []

  const supabase = createClient()

  const { data, error } = await supabase
    .from("foods")
    .select("*")
    .ilike("name", `%${query}%`)
    .limit(20)
    .order("is_verified", { ascending: false })
    .order("name")

  if (error) {
    console.error("Error searching foods:", error)
    return []
  }

  return data || []
}

export async function getTodaysMeals(): Promise<Meal[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const today = new Date().toISOString().split("T")[0]

  const { data: meals, error } = await supabase
    .from("meals")
    .select(`
      *,
      meal_items (
        *,
        food:foods (*)
      )
    `)
    .eq("user_id", user.id)
    .eq("date", today)
    .order("created_at", { ascending: true })

  if (error) throw error
  return meals || []
}

export async function addFoodToMeal(foodId: string, mealType: MealType, quantity = 1) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const today = new Date().toISOString().split("T")[0]

  // Get the food details
  const { data: food, error: foodError } = await supabase.from("foods").select("*").eq("id", foodId).single()

  if (foodError) throw foodError

  // Find or create meal for today
  let { data: meal, error: mealError } = await supabase
    .from("meals")
    .select("*")
    .eq("user_id", user.id)
    .eq("meal_type", mealType)
    .eq("date", today)
    .single()

  if (mealError && mealError.code === "PGRST116") {
    // Meal doesn't exist, create it
    const { data: newMeal, error: createError } = await supabase
      .from("meals")
      .insert({
        user_id: user.id,
        meal_type: mealType,
        date: today,
        name: mealType.charAt(0).toUpperCase() + mealType.slice(1),
      })
      .select()
      .single()

    if (createError) throw createError
    meal = newMeal
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
  const { error: itemError } = await supabase.from("meal_items").insert({
    meal_id: meal.id,
    food_id: foodId,
    quantity,
    unit: food.serving_unit,
    calories,
    protein_g,
    carbs_g,
    fat_g,
    fiber_g,
  })

  if (itemError) throw itemError

  revalidatePath("/dashboard")
}

export async function updateMealItem(itemId: string, newQuantity: number) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Get the meal item with food details
  const { data: item, error: itemError } = await supabase
    .from("meal_items")
    .select(`
      *,
      food:foods (*),
      meal:meals (user_id)
    `)
    .eq("id", itemId)
    .single()

  if (itemError) throw itemError
  if (item.meal.user_id !== user.id) throw new Error("Unauthorized")

  // Recalculate nutrition values
  const calories = item.food.calories_per_serving * newQuantity
  const protein_g = item.food.protein_g * newQuantity
  const carbs_g = item.food.carbs_g * newQuantity
  const fat_g = item.food.fat_g * newQuantity
  const fiber_g = item.food.fiber_g * newQuantity

  // Update the meal item
  const { error: updateError } = await supabase
    .from("meal_items")
    .update({
      quantity: newQuantity,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      fiber_g,
    })
    .eq("id", itemId)

  if (updateError) throw updateError

  revalidatePath("/dashboard")
}

export async function deleteMealItem(itemId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Verify ownership
  const { data: item, error: itemError } = await supabase
    .from("meal_items")
    .select(`
      meal:meals (user_id)
    `)
    .eq("id", itemId)
    .single()

  if (itemError) throw itemError
  if (item.meal.user_id !== user.id) throw new Error("Unauthorized")

  // Delete the meal item
  const { error: deleteError } = await supabase.from("meal_items").delete().eq("id", itemId)

  if (deleteError) throw deleteError

  revalidatePath("/dashboard")
}
