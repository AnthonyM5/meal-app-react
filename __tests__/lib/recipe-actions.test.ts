import { calculateRecipeNutrition } from '@/lib/recipe-utils'
import type { Recipe, RecipeIngredient, Food } from '@/lib/types'

// Helper to create a mock food
function createMockFood(overrides: Partial<Food> = {}): Food {
  return {
    id: 'food-1',
    name: 'Test Food',
    serving_size: 100,
    serving_unit: 'g',
    calories_per_serving: 100,
    protein_g: 10,
    carbs_g: 20,
    fat_g: 5,
    fiber_g: 3,
    is_verified: true,
    ...overrides,
  }
}

// Helper to create a mock recipe ingredient
function createMockIngredient(
  food: Food,
  quantity: number,
  unit: string = 'serving'
): RecipeIngredient {
  return {
    id: `ingredient-${Math.random()}`,
    recipe_id: 'recipe-1',
    food_id: food.id,
    quantity,
    unit,
    created_at: new Date().toISOString(),
    food,
  }
}

// Helper to create a mock recipe
function createMockRecipe(
  servings: number,
  ingredients: RecipeIngredient[]
): Recipe {
  return {
    id: 'recipe-1',
    name: 'Test Recipe',
    created_by: 'user-1',
    is_public: false,
    servings,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    recipe_ingredients: ingredients,
  }
}

describe('calculateRecipeNutrition', () => {
  describe('basic calculations', () => {
    it('should calculate nutrition correctly for a single ingredient', () => {
      const food = createMockFood({
        calories_per_serving: 100,
        protein_g: 10,
        carbs_g: 20,
        fat_g: 5,
        fiber_g: 3,
      })
      const ingredient = createMockIngredient(food, 2) // 2 servings
      const recipe = createMockRecipe(1, [ingredient]) // 1 serving recipe

      const nutrition = calculateRecipeNutrition(recipe, 1)

      // With 2 quantity of ingredient in 1 serving recipe = 2x nutrition
      expect(nutrition.calories).toBe(200)
      expect(nutrition.protein_g).toBe(20)
      expect(nutrition.carbs_g).toBe(40)
      expect(nutrition.fat_g).toBe(10)
      expect(nutrition.fiber_g).toBe(6)
    })

    it('should calculate nutrition correctly for multiple ingredients', () => {
      const food1 = createMockFood({
        id: 'food-1',
        calories_per_serving: 100,
        protein_g: 10,
        carbs_g: 0,
        fat_g: 0,
        fiber_g: 0,
      })
      const food2 = createMockFood({
        id: 'food-2',
        calories_per_serving: 200,
        protein_g: 5,
        carbs_g: 0,
        fat_g: 0,
        fiber_g: 0,
      })

      const ingredient1 = createMockIngredient(food1, 2) // 200 cal, 20g protein
      const ingredient2 = createMockIngredient(food2, 1) // 200 cal, 5g protein

      const recipe = createMockRecipe(2, [ingredient1, ingredient2]) // 2 servings

      const nutrition = calculateRecipeNutrition(recipe, 1)

      // Total: 400 cal, 25g protein, divided by 2 servings = 200 cal, 12.5g protein per serving
      expect(nutrition.calories).toBe(200)
      expect(nutrition.protein_g).toBe(12.5)
    })

    it('should scale nutrition by serving multiplier', () => {
      const food = createMockFood({
        calories_per_serving: 100,
        protein_g: 10,
        carbs_g: 20,
        fat_g: 5,
        fiber_g: 3,
      })
      const ingredient = createMockIngredient(food, 2)
      const recipe = createMockRecipe(2, [ingredient])

      // 1 serving = (2 * 100) / 2 = 100 cal
      const nutrition1x = calculateRecipeNutrition(recipe, 1)
      expect(nutrition1x.calories).toBe(100)

      // 2 servings = 100 * 2 = 200 cal
      const nutrition2x = calculateRecipeNutrition(recipe, 2)
      expect(nutrition2x.calories).toBe(200)

      // 0.5 servings = 100 * 0.5 = 50 cal
      const nutritionHalf = calculateRecipeNutrition(recipe, 0.5)
      expect(nutritionHalf.calories).toBe(50)
    })
  })

  describe('edge cases', () => {
    it('should return zeros when recipe has no ingredients', () => {
      const recipe = createMockRecipe(1, [])

      const nutrition = calculateRecipeNutrition(recipe, 1)

      expect(nutrition.calories).toBe(0)
      expect(nutrition.protein_g).toBe(0)
      expect(nutrition.carbs_g).toBe(0)
      expect(nutrition.fat_g).toBe(0)
      expect(nutrition.fiber_g).toBe(0)
    })

    it('should return zeros when recipe_ingredients is undefined', () => {
      const recipe: Recipe = {
        id: 'recipe-1',
        name: 'Test Recipe',
        created_by: 'user-1',
        is_public: false,
        servings: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        recipe_ingredients: undefined,
      }

      const nutrition = calculateRecipeNutrition(recipe, 1)

      expect(nutrition.calories).toBe(0)
      expect(nutrition.protein_g).toBe(0)
    })

    it('should return zeros when servings is zero', () => {
      const food = createMockFood({
        calories_per_serving: 100,
      })
      const ingredient = createMockIngredient(food, 1)
      const recipe = createMockRecipe(0, [ingredient])

      const nutrition = calculateRecipeNutrition(recipe, 1)

      expect(nutrition.calories).toBe(0)
      expect(nutrition.protein_g).toBe(0)
    })

    it('should skip ingredients without food data', () => {
      const food = createMockFood({
        calories_per_serving: 100,
        protein_g: 10,
      })
      const ingredientWithFood = createMockIngredient(food, 1)
      const ingredientWithoutFood: RecipeIngredient = {
        id: 'ingredient-no-food',
        recipe_id: 'recipe-1',
        food_id: 'missing-food',
        quantity: 1,
        unit: 'serving',
        created_at: new Date().toISOString(),
        food: undefined,
      }

      const recipe = createMockRecipe(1, [ingredientWithFood, ingredientWithoutFood])

      const nutrition = calculateRecipeNutrition(recipe, 1)

      // Only the ingredient with food data should be counted
      expect(nutrition.calories).toBe(100)
      expect(nutrition.protein_g).toBe(10)
    })

    it('should handle fractional servings correctly', () => {
      const food = createMockFood({
        calories_per_serving: 100,
        protein_g: 10,
      })
      const ingredient = createMockIngredient(food, 3)
      const recipe = createMockRecipe(1.5, [ingredient])

      // 1 serving = (3 * 100) / 1.5 = 200 cal
      const nutrition = calculateRecipeNutrition(recipe, 1)
      expect(nutrition.calories).toBe(200)
      expect(nutrition.protein_g).toBe(20)
    })

    it('should handle default serving multiplier of 1', () => {
      const food = createMockFood({
        calories_per_serving: 100,
      })
      const ingredient = createMockIngredient(food, 1)
      const recipe = createMockRecipe(1, [ingredient])

      const nutrition = calculateRecipeNutrition(recipe)
      expect(nutrition.calories).toBe(100)
    })
  })

  describe('real-world scenarios', () => {
    it('should calculate PB&J sandwich nutrition correctly', () => {
      const bread = createMockFood({
        id: 'bread',
        name: 'Whole Wheat Bread',
        calories_per_serving: 80,
        protein_g: 4,
        carbs_g: 15,
        fat_g: 1,
        fiber_g: 2,
      })

      const peanutButter = createMockFood({
        id: 'pb',
        name: 'Peanut Butter',
        calories_per_serving: 190,
        protein_g: 7,
        carbs_g: 7,
        fat_g: 16,
        fiber_g: 2,
      })

      const jelly = createMockFood({
        id: 'jelly',
        name: 'Grape Jelly',
        calories_per_serving: 50,
        protein_g: 0,
        carbs_g: 13,
        fat_g: 0,
        fiber_g: 0,
      })

      const ingredients = [
        createMockIngredient(bread, 2), // 2 slices
        createMockIngredient(peanutButter, 2), // 2 tbsp
        createMockIngredient(jelly, 1), // 1 tbsp
      ]

      const recipe = createMockRecipe(1, ingredients) // Makes 1 sandwich

      const nutrition = calculateRecipeNutrition(recipe, 1)

      // Total: 2*80 + 2*190 + 1*50 = 160 + 380 + 50 = 590 cal
      expect(nutrition.calories).toBe(590)
      // Total protein: 2*4 + 2*7 + 0 = 8 + 14 = 22g
      expect(nutrition.protein_g).toBe(22)
      // Total carbs: 2*15 + 2*7 + 13 = 30 + 14 + 13 = 57g
      expect(nutrition.carbs_g).toBe(57)
      // Total fat: 2*1 + 2*16 + 0 = 2 + 32 = 34g
      expect(nutrition.fat_g).toBe(34)
      // Total fiber: 2*2 + 2*2 + 0 = 4 + 4 = 8g
      expect(nutrition.fiber_g).toBe(8)
    })

    it('should handle a recipe that makes 4 servings', () => {
      const pasta = createMockFood({
        id: 'pasta',
        name: 'Pasta',
        calories_per_serving: 200,
        protein_g: 7,
        carbs_g: 42,
        fat_g: 1,
        fiber_g: 2,
      })

      const sauce = createMockFood({
        id: 'sauce',
        name: 'Marinara Sauce',
        calories_per_serving: 70,
        protein_g: 2,
        carbs_g: 10,
        fat_g: 2,
        fiber_g: 2,
      })

      const ingredients = [
        createMockIngredient(pasta, 4), // 4 servings of pasta
        createMockIngredient(sauce, 2), // 2 servings of sauce
      ]

      const recipe = createMockRecipe(4, ingredients) // Makes 4 servings

      // Per serving: (4*200 + 2*70) / 4 = (800 + 140) / 4 = 235 cal
      const nutritionPerServing = calculateRecipeNutrition(recipe, 1)
      expect(nutritionPerServing.calories).toBe(235)

      // 2 servings = 470 cal
      const nutritionTwoServings = calculateRecipeNutrition(recipe, 2)
      expect(nutritionTwoServings.calories).toBe(470)
    })
  })
})
