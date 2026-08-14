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
  // --- Corpus metadata (backfilled from source_payloads, migration 20260729000000) ---
  /** FDC dataType: 'Foundation' | 'SR Legacy'. Null for non-USDA rows. */
  usda_data_type?: string | null
  /** FDC foodCategory.description, e.g. 'Legumes and Legume Products' */
  food_category?: string | null
  /**
   * FALSE hides the row from search without deleting it. Soft delete exists
   * because meal_items/recipe_ingredients cascade off `foods` — a hard DELETE
   * would destroy owners' logged meals.
   */
  is_active?: boolean
  /** Why the row was deactivated ('prune:<rule>', 'duplicate_of:<uuid>') */
  inactive_reason?: string | null
  // --- Canonical layer (migration 20260729000200) ---
  /** The canonical ingredient this row is a variant of */
  canonical_id?: string | null
  /** Structured attributes parsed out of the description */
  variant_attrs?: FoodVariantAttrs | null
  /** The variant shown when its canonical group is collapsed */
  is_canonical_default?: boolean
}

/**
 * Attributes that distinguish variants sharing one canonical key. This is the
 * single source of truth; apps/web/lib/food-name-parser.ts (which writes it)
 * aliases this type as `VariantAttrs`.
 */
export interface FoodVariantAttrs {
  prep: string[]
  trim: string[]
  grade: string[]
  origin: string[]
  /** USDA grouping segments that carry no nutritional meaning */
  grouping: string[]
  /** Segments no gazetteer claimed — the parser's blind-spot log */
  residual: string[]
}

/**
 * A group of `foods` variants that are the same ingredient. Populated by
 * scripts/026_build_canonical_ingredients.ts; `foods` is the variant table.
 */
export interface CanonicalIngredient {
  id: string
  /** Dedupe anchor: 'beef_round', 'chicken_breast' */
  slug: string
  display_name: string
  base_food: string
  /** Primal cut / organ; null for whole foods */
  part: string | null
  category: string | null
  /**
   * FALSE when ANY variant in the group is explicitly unsafe (pessimistic
   * rollup — for a dog app the failure direction must be toward caution).
   * NULL/unknown variant safety does not trip the flag.
   */
  is_safe_for_dogs: boolean
  variant_count: number
  created_at: string
  updated_at: string
}

/**
 * The canonical group a matched ingredient landed in, plus whether its
 * variants disagree enough that the owner must choose one explicitly.
 *
 * The vision model reports "ground beef" and cannot see the lean/fat ratio —
 * but that ratio spans 121-332 kcal/100 g. When `requiresChoice` is true the
 * client MUST make the owner pick a variant (expand the group via the
 * grouped-search variants endpoint) before logging the meal; the pre-filled
 * ingredient is a guess, not a measurement.
 *
 * Ranges and `variantCount` are scoped to variants matching the OBSERVED
 * preparation state (raw vs cooked legitimately differ per 100 g by water
 * loss, and that difference is not the owner's choice to make here), and are
 * normalized to per-100 g via `per100g`.
 *
 * When `observedPreparation` is set, a client rendering the picker MUST filter
 * the variant list to it. `variantCount` and the ranges describe that filtered
 * set, so listing every variant makes the copy produced by
 * `describeVariantChoice` describe a different set than the one on screen —
 * "3 options span 121–332 kcal" above a list of nine, four of them raw. It
 * also lets the owner silently undo the model's observation by picking a raw
 * row for a meal seen as cooked. Owners who need a genuinely different food
 * still have the row-level "Search to replace" affordance, which deliberately
 * supersedes this gate.
 */
export interface CanonicalMatch {
  canonicalId: string
  displayName: string
  variantCount: number
  /** Owner must explicitly choose a variant before the bowl can be logged */
  requiresChoice: boolean
  /**
   * The preparation state was never observed, and this group offers more than
   * one. The owner is asked rather than defaulted into a guess: nothing in the
   * pipeline can see whether a bowl was cooked unless the vision model says
   * so, and a raw-vs-cooked mix-up is a factual error about the meal, not a
   * rounding difference. When true, `requiresChoice` is also true.
   */
  prepUnresolved: boolean
  /** Preparation states this group actually contains, e.g. ['cooked','raw'] */
  availablePreparations: string[]
  /**
   * The preparation state the pipeline OBSERVED, or null if it never did.
   * When set, `variantCount`/`kcalRange`/`fatRange` cover only variants in
   * this state, and the picker must filter to it (see the interface docs).
   * Mutually exclusive with `prepUnresolved` being true.
   */
  observedPreparation: 'raw' | 'cooked' | null
  /** [min, max] kcal per 100 g across the comparable variants */
  kcalRange: [number, number] | null
  /** [min, max] fat g per 100 g across the comparable variants */
  fatRange: [number, number] | null
}

/**
 * Why the owner is being asked to choose, in their words.
 *
 * Shared by the web and mobile variant pickers so the two cannot drift. The
 * reason matters: "raw or cooked?" and "which cut?" are different questions,
 * and the old copy explained every prompt as a nutrient spread — which reads
 * as nonsense on a group like carrots, where the spread is 35-41 kcal and the
 * real ambiguity is that nobody ever established whether they were cooked.
 */
export function describeVariantChoice(canonical: CanonicalMatch): string {
  const kcal = canonical.kcalRange
    ? `${Math.round(canonical.kcalRange[0])}–${Math.round(canonical.kcalRange[1])} kcal`
    : null
  const fat = canonical.fatRange
    ? `${canonical.fatRange[0]}–${canonical.fatRange[1]} g fat`
    : null
  const spread = [kcal, fat].filter(Boolean).join(' and ')

  if (canonical.prepUnresolved) {
    const states = canonical.availablePreparations.join(' or ')
    return (
      `The photo doesn't show whether this was ${states || 'raw or cooked'}, ` +
      `and we won't guess — cooking changes the numbers per 100 g` +
      (spread ? ` (${spread} across ${canonical.variantCount} options)` : '') +
      '.'
    )
  }
  return (
    `The photo can't show this. ${canonical.variantCount} options span ` +
    `${spread} per 100 g — picking the wrong one skews the whole bowl.`
  )
}

/**
 * Normalize a per-serving value to per-100 g.
 *
 * Every writer in this codebase sets `serving_size = 100` ('g'), so this is
 * usually the identity — but that convention was previously assumed, not
 * enforced. Any code that DISPLAYS or COMPARES "per 100 g" numbers must go
 * through this instead of reading `*_per_serving` raw. Null/zero/missing
 * serving sizes fall back to the schema default of 100.
 */
export function per100g(
  value: number | null | undefined,
  servingSize: number | null | undefined
): number | null {
  const v = Number(value)
  if (!Number.isFinite(v)) return null
  const size = Number(servingSize)
  if (!Number.isFinite(size) || size <= 0) return v
  return (v * 100) / size
}

/** One row of grouped search: the canonical plus its default variant. */
export interface CanonicalSearchResult {
  canonical_id: string
  slug: string
  display_name: string
  base_food: string
  part: string | null
  category: string | null
  variant_count: number
  group_is_safe: boolean
  /** The default variant's id and nutrition, so no second round trip */
  food_id: string
  name: string
  brand: string | null
  serving_size: number
  calories_per_serving: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  preparation_state: PreparationState | null
  is_verified: boolean
  source: IngredientSource | null
  data_completeness: DataCompleteness | null
  similarity: number
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
  /** Inner diameter of the dog's usual bowl (cm) — photo-scale reference */
  bowl_diameter_cm?: number | null
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
  /** Grams the owner actually confirmed — §2.4's calibration ground truth */
  grams?: number | null
  /** What the photo pipeline predicted, so correction deltas are computable */
  estimated_grams?: number | null
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
      /** Grouped search over the canonical layer (migration 20260729000300) */
      search_canonical_ingredients: {
        Args: {
          search_query: string
          match_limit?: number
        }
        Returns: CanonicalSearchResult[]
      }
      /** Expand one canonical group into its variants */
      list_canonical_variants: {
        Args: {
          p_canonical_id: string
          match_limit?: number
        }
        Returns: Array<Food & { variant_attrs: FoodVariantAttrs | null }>
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
