"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { Food, MealType } from "@/lib/types"

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

export async function addFoodToMeal(
  foodId: string,
  mealType: MealType,
  quantity = 1,
  date: string = new Date().toISOString().split("T")[0],
) {
  const supabase = createClient()

  // Get the current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error("User not authenticated")
  }

  // Get the food details
  const { data: food, error: foodError } = await supabase.from("foods").select("*").eq("id", foodId).single()

  if (foodError || !food) {
    throw new Error("Food not found")
  }

  // Find or create a meal for this date and meal type
  let { data: meal, error: mealError } = await supabase
    .from("meals")
    .select("*")
    .eq("user_id", user.id)
    .eq("meal_type", mealType)
    .eq("date", date)
    .single()

  if (mealError && mealError.code === "PGRST116") {
    // Meal doesn't exist, create it
    const { data: newMeal, error: createError } = await supabase
      .from("meals")
      .insert({
        user_id: user.id,
        meal_type: mealType,
        date: date,
        name: mealType.charAt(0).toUpperCase() + mealType.slice(1),
      })
      .select()
      .single()

    if (createError) {
      throw new Error("Failed to create meal")
    }
    meal = newMeal
  } else if (mealError) {
    throw new Error("Failed to find meal")
  }

  // Calculate nutrition values based on quantity
  const calories = food.calories_per_serving * quantity
  const protein = food.protein_g * quantity
  const carbs = food.carbs_g * quantity
  const fat = food.fat_g * quantity
  const fiber = food.fiber_g * quantity

  // Add the food to the meal
  const { error: insertError } = await supabase.from("meal_items").insert({
    meal_id: meal.id,
    food_id: foodId,
    quantity: quantity,
    unit: "serving",
    calories: calories,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    fiber_g: fiber,
  })

  if (insertError) {
    throw new Error("Failed to add food to meal")
  }

  revalidatePath("/dashboard")
  return { success: true }
}

export async function getTodaysMeals() {
  const supabase = createClient()
  const today = new Date().toISOString().split("T")[0]

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) {
    return []
  }

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
    .order("meal_type")

  if (error) {
    console.error("Error fetching meals:", error)
    return []
  }

  return meals || []
}

export async function removeMealItem(mealItemId: string) {
  const supabase = createClient()

  const { error } = await supabase.from("meal_items").delete().eq("id", mealItemId)

  if (error) {
    throw new Error("Failed to remove item")
  }

  revalidatePath("/dashboard")
  return { success: true }
}
