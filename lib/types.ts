export interface Food {
  id: string
  fdc_id?: number | null
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
  // Canine-critical nutrients (PawPlate)
  taurine_mg?: number
  phosphorus_mg?: number
  omega3_epa_dha_mg?: number
  omega6_la_mg?: number
  vitamin_d_iu?: number
  choline_mg?: number
  copper_mg?: number
  manganese_mg?: number
  iodine_mcg?: number
  methionine_cystine_mg?: number
  lysine_mg?: number
  tryptophan_mg?: number
  threonine_mg?: number
  isoleucine_mg?: number
  leucine_mg?: number
  valine_mg?: number
  arginine_mg?: number
  histidine_mg?: number
  phenylalanine_tyrosine_mg?: number
  thiamin_mg?: number
  riboflavin_mg?: number
  niacin_mg?: number
  pantothenic_acid_mg?: number
  vitamin_b6_mg?: number
  is_safe_for_dogs?: boolean
  toxicity_note?: string | null
  /** Values describe the food as fed; null = unknown/not applicable */
  preparation_state?: PreparationState | null
  is_verified: boolean
  // --- Provenance / branded-ingredient support (PawPlate) ---
  /** Where this row came from. Defaults are backfilled from fdc_id. */
  source?: IngredientSource
  /** EAN/UPC for branded products; dedupe key for OFF/FatSecret imports */
  barcode?: string | null
  /** Source's own product id (OFF code, FatSecret food_id) */
  external_id?: string | null
  /** Required attribution string (e.g. ODbL credit for OFF data) */
  source_attribution?: string | null
  /** Branded complete meal logged as one line item, not decomposed */
  is_complete_food?: boolean
  /** How much of the nutrient profile is actually reported */
  data_completeness?: DataCompleteness
}

export type PreparationState = 'raw' | 'cooked'

/** Provenance of an ingredient row. Branded = 'off' | 'fatsecret'. */
export type IngredientSource =
  | 'usda'
  | 'curated'
  | 'off'
  | 'fatsecret'
  | 'manual'

export type DataCompleteness = 'full' | 'macros_only' | 'sparse'

/** Sources whose micronutrient data is NOT trusted for gap math (§6). */
export const BRANDED_SOURCES: readonly IngredientSource[] = ['off', 'fatsecret']

// The physical table is still named `foods` (renaming would ripple through
// the USDA importer and the fuzzy_search_foods RPC); PawPlate exposes it
// as Ingredient in the type/UI layer.
export type Ingredient = Food

export type DogLifeStage =
  | 'puppy'
  | 'adult'
  | 'senior'
  | 'pregnant'
  | 'lactating'
export type DogActivityLevel =
  | 'sedentary'
  | 'lightly_active'
  | 'moderately_active'
  | 'very_active'
  | 'working'
export type MealSource = 'manual' | 'photo' | 'recipe'

export interface Dog {
  id: string
  owner_id: string
  name: string
  breed?: string | null
  weight_kg: number
  ideal_weight_kg?: number | null
  birth_date?: string | null
  life_stage: DogLifeStage
  activity_level: DogActivityLevel
  neutered: boolean
  health_conditions: string[]
  avatar_url?: string | null
  created_at: string
  updated_at: string
}

export interface NutrientRequirement {
  id: string
  nutrient_key: string
  life_stage: DogLifeStage
  /** Requirement per 1000 kcal ME; null = tracked but no formal RDA */
  amount_per_1000kcal: number | null
  unit: string
  min_value: number | null
  max_value: number | null
  source: string
  notes?: string | null
}

export interface BowlAnalysisItem {
  ingredient_id: string | null
  name: string
  proportion: number
  confidence: number
}

export interface BowlAnalysis {
  id: string
  dog_id: string | null
  image_url: string
  model_version: string
  raw_output: unknown
  identified_items: BowlAnalysisItem[]
  user_corrected: BowlAnalysisItem[] | null
  /** Owner's free-text hint to the vision model; latest hint wins on re-analysis */
  user_hint: string | null
  created_at: string
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
  dog_id?: string | null
  source?: MealSource
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

// Raw USDA/OFF API responses archived at import time (see migration
// 20260711000000_add_source_payloads.sql and lib/source-payloads.ts)
export interface SourcePayload {
  id: string
  source: 'usda' | 'off'
  kind: 'detail' | 'search'
  external_id: string
  payload: Record<string, unknown>
  food_id: string | null
  fetched_at: string
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
      dogs: {
        Row: Dog
        Insert: Omit<Dog, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Dog, 'id' | 'owner_id' | 'created_at' | 'updated_at'>>
      }
      nutrient_requirements: {
        Row: NutrientRequirement
        Insert: Omit<NutrientRequirement, 'id'>
        Update: Partial<Omit<NutrientRequirement, 'id'>>
      }
      bowl_analyses: {
        Row: BowlAnalysis
        Insert: Omit<BowlAnalysis, 'id' | 'created_at'>
        Update: Partial<Omit<BowlAnalysis, 'id' | 'created_at'>>
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
      source_payloads: {
        Row: SourcePayload
        Insert: Omit<SourcePayload, 'id'>
        Update: Partial<Omit<SourcePayload, 'id'>>
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
      fuzzy_search_foods: {
        Args: {
          search_query: string
          match_limit: number
        }
        Returns: Array<Food & { similarity: number }>
      }
      consume_guest_bowl_quota: {
        Args: {
          p_ip_hash: string
          p_limit: number
        }
        Returns: boolean
      }
    }
  }
}
