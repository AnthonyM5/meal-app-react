export interface Food {
  id: string
  name: string
  brand?: string
  serving_size: number
  serving_unit: string
  calories_per_serving: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  sugar_g?: number
  sodium_mg?: number
  cholesterol_mg?: number
  vitamin_a_mcg?: number
  vitamin_c_mg?: number
  vitamin_d_mcg?: number
  vitamin_e_mg?: number
  vitamin_b12_mcg?: number
  calcium_mg?: number
  iron_mg?: number
  magnesium_mg?: number
  potassium_mg?: number
  zinc_mg?: number
  selenium_mcg?: number
  folate_mcg?: number
  is_verified: boolean
}

export interface Recipe {
  id: string
  name: string
  description?: string
  created_by: string
  is_public: boolean
  servings: number
  created_at: string
  updated_at: string
  recipe_ingredients?: RecipeIngredient[]
}

export interface RecipeIngredient {
  id: string
  recipe_id: string
  food_id: string
  quantity: number
  unit: string
  created_at: string
  food?: Food
}

export interface Meal {
  id: string
  user_id: string
  name?: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  date: string
  notes?: string
  created_at: string
  meal_items: MealItem[]
}

export interface MealItem {
  id: string
  meal_id: string
  food_id?: string
  recipe_id?: string
  quantity: number
  unit: string
  serving_multiplier: number
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  food?: Food
  recipe?: Recipe
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type ActivityLevel =
  | 'sedentary'
  | 'lightly_active'
  | 'moderately_active'
  | 'very_active'
  | 'extremely_active'
export type GoalType =
  | 'lose_weight'
  | 'maintain_weight'
  | 'gain_weight'
  | 'build_muscle'

export interface Database {
  public: {
    Tables: {
      foods: {
        Row: Food
        Insert: Omit<Food, 'id'>
        Update: Partial<Omit<Food, 'id'>>
      }
      meals: {
        Row: Meal
        Insert: Omit<Meal, 'id' | 'created_at' | 'meal_items'>
        Update: Partial<Omit<Meal, 'id' | 'created_at' | 'meal_items'>>
      }
      meal_items: {
        Row: MealItem
        Insert: Omit<MealItem, 'id'>
        Update: Partial<Omit<MealItem, 'id'>>
      }
      recipes: {
        Row: Recipe
        Insert: Omit<Recipe, 'id' | 'created_at' | 'updated_at' | 'recipe_ingredients'>
        Update: Partial<Omit<Recipe, 'id' | 'created_at' | 'updated_at' | 'recipe_ingredients'>>
      }
      recipe_ingredients: {
        Row: RecipeIngredient
        Insert: Omit<RecipeIngredient, 'id' | 'created_at' | 'food'>
        Update: Partial<Omit<RecipeIngredient, 'id' | 'created_at' | 'food'>>
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name?: string
          avatar_url?: string
          age?: number
          gender?: 'male' | 'female' | 'other'
          height_cm?: number
          weight_kg?: number
          activity_level: ActivityLevel
          goal_type: GoalType
          target_calories?: number
          target_protein?: number
          target_carbs?: number
          target_fat?: number
          target_fiber?: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['profiles']['Row'],
          'id' | 'created_at' | 'updated_at'
        >
        Update: Partial<
          Omit<
            Database['public']['Tables']['profiles']['Row'],
            'id' | 'created_at' | 'updated_at'
          >
        >
      }
    }
    Functions: {
      search_foods_by_nutrient: {
        Args: {
          nutrient_name: string
          min_amount: number
          limit_count: number
        }
        Returns: Array<
          Food & { nutrient_amount: number; nutrient_unit: string }
        >
      }
    }
  }
}
