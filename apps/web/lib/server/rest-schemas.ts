import { z } from 'zod'

/**
 * Zod schemas for the mobile REST route request bodies. These gate the TYPE
 * of every incoming field at the trust boundary (a native client can send
 * arbitrary JSON), so a wrong type — e.g. `weight_kg: "abc"` — is rejected
 * with a 400 instead of slipping past the JS `<= 0` check (NaN comparisons
 * are false) and blowing up as an opaque Postgres 500 downstream.
 *
 * They intentionally do NOT duplicate the business rules that live in
 * lib/services/* (non-empty name, weight > 0, kcal ≥ 0). Those stay the
 * single source of truth and run identically for the web Server Actions;
 * these schemas only ensure the shapes are well-typed before they get there.
 *
 * The inferred output types are structurally compatible with the service
 * input interfaces (DogInput, DogMealItemInput, ManualIngredientInput, …),
 * so passing a parsed body straight into a service function is checked by
 * tsc — if a schema drifts from its interface, the build fails.
 */

const lifeStage = z.enum(['puppy', 'adult', 'senior', 'pregnant', 'lactating'])
const activityLevel = z.enum([
  'sedentary',
  'lightly_active',
  'moderately_active',
  'very_active',
  'working',
])
const mealType = z.enum(['breakfast', 'lunch', 'dinner', 'snack'])
const mealSource = z.enum(['manual', 'photo', 'recipe'])

export const DogCreateSchema = z.object({
  name: z.string(),
  breed: z.string().nullable().optional(),
  weight_kg: z.number(),
  ideal_weight_kg: z.number().nullable().optional(),
  birth_date: z.string().nullable().optional(),
  life_stage: lifeStage.optional(),
  activity_level: activityLevel.optional(),
  neutered: z.boolean().optional(),
  health_conditions: z.array(z.string()).optional(),
  avatar_url: z.string().nullable().optional(),
  bowl_diameter_cm: z.number().nullable().optional(),
})

export const DogUpdateSchema = DogCreateSchema.partial()

const mealItem = z.object({
  ingredient_id: z.string(),
  grams: z.number(),
})

export const MealCreateSchema = z.object({
  meal_type: mealType,
  items: z.array(mealItem),
  source: mealSource.optional(),
  name: z.string().optional(),
  date: z.string().optional(),
})

export const MealUpdateSchema = z.object({
  meal_type: mealType,
  items: z.array(mealItem),
  name: z.string().optional(),
})

export const ManualIngredientSchema = z.object({
  name: z.string(),
  calories_per_100g: z.number(),
  protein_g_per_100g: z.number().optional(),
  fat_g_per_100g: z.number().optional(),
  carbs_g_per_100g: z.number().optional(),
})

export const BrandedIngredientSchema = z.object({
  code: z
    .string({ required_error: 'code is required' })
    .min(1, 'code is required'),
})
