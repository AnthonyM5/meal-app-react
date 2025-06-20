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
  is_verified: boolean
}

export interface Meal {
  id: string
  user_id: string
  name?: string
  meal_type: "breakfast" | "lunch" | "dinner" | "snack"
  date: string
  notes?: string
  created_at: string
  meal_items: MealItem[]
}

export interface MealItem {
  id: string
  meal_id: string
  food_id: string
  quantity: number
  unit: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  food: Food
}

export type MealType = "breakfast" | "lunch" | "dinner" | "snack"
