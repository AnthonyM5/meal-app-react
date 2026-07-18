import type { Recipe } from '@/lib/types'

export interface RecipeNutrition {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
}

/**
 * Calculate the total nutrition for a recipe based on its ingredients.
 * 
 * @param recipe - The recipe with its ingredients
 * @param servingMultiplier - Multiply the nutrition by this factor (default: 1)
 * @returns The calculated nutrition values
 */
export function calculateRecipeNutrition(
  recipe: Recipe,
  servingMultiplier: number = 1
): RecipeNutrition {
  const totals: RecipeNutrition = {
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fiber_g: 0,
  }

  if (!recipe.recipe_ingredients || recipe.servings <= 0) {
    return totals
  }

  for (const ingredient of recipe.recipe_ingredients) {
    if (!ingredient.food) continue

    const multiplier = (ingredient.quantity / recipe.servings) * servingMultiplier

    totals.calories += ingredient.food.calories_per_serving * multiplier
    totals.protein_g += ingredient.food.protein_g * multiplier
    totals.carbs_g += ingredient.food.carbs_g * multiplier
    totals.fat_g += ingredient.food.fat_g * multiplier
    totals.fiber_g += ingredient.food.fiber_g * multiplier
  }

  return totals
}
