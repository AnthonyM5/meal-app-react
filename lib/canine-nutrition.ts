// Deterministic canine nutrition engine.
//
// This module is the trust anchor of PawPlate: every number shown to an
// owner ("Biscuit is at 62% of taurine RDA") is computed here with plain
// arithmetic from the structured nutrient store. No LLM, no network —
// keep it that way.

import type {
  Dog,
  DogActivityLevel,
  DogLifeStage,
  Ingredient,
  NutrientRequirement,
} from '@/lib/types'

// ---------------------------------------------------------------------------
// Tracked nutrients
// ---------------------------------------------------------------------------

/**
 * Nutrient keys tracked by the engine. Each key is simultaneously:
 *  - a column on the `foods` table (per 100 g), and
 *  - a `nutrient_key` in `nutrient_requirements` (per 1000 kcal ME).
 */
export const TRACKED_NUTRIENTS = [
  'protein_g',
  'fat_g',
  'calcium_mg',
  'phosphorus_mg',
  'potassium_mg',
  'sodium_mg',
  'magnesium_mg',
  'iron_mg',
  'copper_mg',
  'manganese_mg',
  'zinc_mg',
  'iodine_mcg',
  'selenium_mcg',
  'vitamin_a_mcg',
  'vitamin_d_iu',
  'vitamin_e_mg',
  'vitamin_b12_mcg',
  'folate_mcg',
  'choline_mg',
  'taurine_mg',
  'omega3_epa_dha_mg',
  'omega6_la_mg',
  'methionine_cystine_mg',
  'lysine_mg',
  'tryptophan_mg',
] as const

export type NutrientKey = (typeof TRACKED_NUTRIENTS)[number]

export type NutrientTotals = Record<NutrientKey, number> & { calories: number }

// ---------------------------------------------------------------------------
// Energy model (NRC 2006)
// ---------------------------------------------------------------------------

export interface DogEnergyInputs {
  weightKg: number
  idealWeightKg?: number | null
  lifeStage: DogLifeStage
  activityLevel: DogActivityLevel
  neutered: boolean
  /** Needed to distinguish young puppies (<4 months); optional otherwise */
  ageMonths?: number | null
}

/** RER = 70 * kg^0.75 (kcal/day) */
export function restingEnergyRequirement(weightKg: number): number {
  if (weightKg <= 0) throw new Error('weightKg must be positive')
  return 70 * Math.pow(weightKg, 0.75)
}

/**
 * Maintenance-energy multiplier applied to RER.
 * Values follow common veterinary practice (NRC 2006 / WSAVA guidance).
 */
export function merFactor(dog: DogEnergyInputs): number {
  switch (dog.lifeStage) {
    case 'puppy':
      // Young puppies burn ~3x RER; older puppies ~2x.
      return dog.ageMonths != null && dog.ageMonths < 4 ? 3.0 : 2.0
    case 'pregnant':
      return 2.0
    case 'lactating':
      return 3.0
    case 'senior': {
      const seniorByActivity: Record<DogActivityLevel, number> = {
        sedentary: 1.2,
        lightly_active: 1.3,
        moderately_active: 1.4,
        very_active: 1.6,
        working: 2.0,
      }
      return seniorByActivity[dog.activityLevel]
    }
    case 'adult': {
      const adultByActivity: Record<DogActivityLevel, number> = {
        sedentary: 1.2,
        lightly_active: 1.4,
        moderately_active: dog.neutered ? 1.6 : 1.8,
        very_active: 2.0,
        working: 3.0,
      }
      return adultByActivity[dog.activityLevel]
    }
  }
}

export function dailyEnergyRequirement(
  weightKg: number,
  factor: number
): number {
  return restingEnergyRequirement(weightKg) * factor
}

/**
 * Daily kcal target for a dog. Dogs above their ideal weight get a
 * weight-loss prescription: 1.0 x RER of the *ideal* weight.
 */
export function dailyEnergyForDog(dog: DogEnergyInputs): number {
  const overweight =
    dog.idealWeightKg != null && dog.weightKg > dog.idealWeightKg * 1.1
  if (overweight) {
    return restingEnergyRequirement(dog.idealWeightKg as number) * 1.0
  }
  return dailyEnergyRequirement(dog.weightKg, merFactor(dog))
}

export function energyInputsFromDog(dog: Dog): DogEnergyInputs {
  let ageMonths: number | null = null
  if (dog.birth_date) {
    const ms = Date.now() - new Date(dog.birth_date).getTime()
    ageMonths = ms / (1000 * 60 * 60 * 24 * 30.44)
  }
  return {
    weightKg: Number(dog.weight_kg),
    idealWeightKg: dog.ideal_weight_kg != null ? Number(dog.ideal_weight_kg) : null,
    lifeStage: dog.life_stage,
    activityLevel: dog.activity_level,
    neutered: dog.neutered,
    ageMonths,
  }
}

// ---------------------------------------------------------------------------
// Meal totals
// ---------------------------------------------------------------------------

export interface MealItemInput {
  grams: number
  ingredient: Ingredient
}

function emptyTotals(): NutrientTotals {
  const totals = { calories: 0 } as NutrientTotals
  for (const key of TRACKED_NUTRIENTS) totals[key] = 0
  return totals
}

/**
 * Sum every tracked nutrient across meal items. Ingredient values are
 * per `serving_size` grams (100 g by convention), so scale by grams.
 */
export function computeMealNutrients(items: MealItemInput[]): NutrientTotals {
  const totals = emptyTotals()
  for (const { grams, ingredient } of items) {
    if (grams < 0) throw new Error('grams cannot be negative')
    const servingSize = Number(ingredient.serving_size) || 100
    const scale = grams / servingSize
    totals.calories += Number(ingredient.calories_per_serving || 0) * scale
    for (const key of TRACKED_NUTRIENTS) {
      totals[key] += Number(ingredient[key] ?? 0) * scale
    }
  }
  return totals
}

/** Ingredients flagged unsafe for dogs — surface these before any math. */
export function findUnsafeIngredients(items: MealItemInput[]): Ingredient[] {
  return items
    .map(i => i.ingredient)
    .filter(ing => ing.is_safe_for_dogs === false)
}

// ---------------------------------------------------------------------------
// Targets & gaps
// ---------------------------------------------------------------------------

export interface NutrientTarget {
  nutrientKey: NutrientKey
  /** Daily amount; null = tracked but no formal RDA (informational) */
  dailyTarget: number | null
  dailyMin: number | null
  dailyMax: number | null
  unit: string
  source: string
}

export interface DogTargets {
  dailyKcal: number
  targets: Partial<Record<NutrientKey, NutrientTarget>>
}

/**
 * Requirements are seeded for the AAFCO profiles 'adult' (maintenance) and
 * 'puppy' (growth & reproduction). Other life stages map onto those.
 */
export function requirementLifeStage(stage: DogLifeStage): DogLifeStage {
  switch (stage) {
    case 'pregnant':
    case 'lactating':
      return 'puppy' // AAFCO "growth & reproduction" profile
    case 'senior':
      return 'adult'
    default:
      return stage
  }
}

/**
 * Resolve per-nutrient daily targets for a dog:
 * amount_per_1000kcal * (daily kcal / 1000).
 */
export function computeTargets(
  dog: DogEnergyInputs,
  requirements: NutrientRequirement[]
): DogTargets {
  const dailyKcal = dailyEnergyForDog(dog)
  const kcalFactor = dailyKcal / 1000
  const stage = requirementLifeStage(dog.lifeStage)

  const targets: Partial<Record<NutrientKey, NutrientTarget>> = {}
  for (const req of requirements) {
    if (req.life_stage !== stage) continue
    const key = req.nutrient_key as NutrientKey
    if (!TRACKED_NUTRIENTS.includes(key)) continue
    targets[key] = {
      nutrientKey: key,
      dailyTarget:
        req.amount_per_1000kcal != null
          ? Number(req.amount_per_1000kcal) * kcalFactor
          : null,
      dailyMin: req.min_value != null ? Number(req.min_value) * kcalFactor : null,
      dailyMax: req.max_value != null ? Number(req.max_value) * kcalFactor : null,
      unit: req.unit,
      source: req.source,
    }
  }
  return { dailyKcal, targets }
}

export type GapStatus =
  | 'deficient'
  | 'adequate'
  | 'excess'
  | 'toxic_risk'
  | 'informational'

export interface NutrientGap {
  nutrientKey: NutrientKey
  consumed: number
  dailyTarget: number | null
  dailyMax: number | null
  unit: string
  /** percent of daily target; null when there is no formal target */
  pct: number | null
  status: GapStatus
}

// Classification thresholds (fractions of daily target)
const DEFICIENT_BELOW = 0.9
const EXCESS_ABOVE = 1.5

export function computeGaps(
  totals: NutrientTotals,
  dogTargets: DogTargets
): Partial<Record<NutrientKey, NutrientGap>> {
  const gaps: Partial<Record<NutrientKey, NutrientGap>> = {}

  for (const target of Object.values(dogTargets.targets)) {
    const consumed = totals[target.nutrientKey] ?? 0
    let status: GapStatus
    let pct: number | null = null

    if (target.dailyMax != null && consumed > target.dailyMax) {
      // Safe upper bound breached (critical for calcium, vitamin D)
      status = 'toxic_risk'
      if (target.dailyTarget) pct = (consumed / target.dailyTarget) * 100
    } else if (target.dailyTarget == null) {
      status = 'informational'
    } else {
      pct = (consumed / target.dailyTarget) * 100
      if (consumed < target.dailyTarget * DEFICIENT_BELOW) status = 'deficient'
      else if (consumed > target.dailyTarget * EXCESS_ABOVE) status = 'excess'
      else status = 'adequate'
    }

    gaps[target.nutrientKey] = {
      nutrientKey: target.nutrientKey,
      consumed,
      dailyTarget: target.dailyTarget,
      dailyMax: target.dailyMax,
      unit: target.unit,
      pct: pct != null ? Math.round(pct * 10) / 10 : null,
      status,
    }
  }
  return gaps
}

/**
 * Percent-of-target map, same shape `calculateDailyProgress` produced for
 * the human app, so existing progress UI can be reused unchanged.
 */
export function calculateDailyProgress(
  gaps: Partial<Record<NutrientKey, NutrientGap>>
): Record<string, number> {
  const progress: Record<string, number> = {}
  for (const gap of Object.values(gaps)) {
    progress[gap.nutrientKey] = gap.pct != null ? Math.round(gap.pct) : 0
  }
  return progress
}

/** Ca:P balance — must stay between 1:1 and 2:1 for dogs. */
export function calciumPhosphorusRatio(totals: NutrientTotals): number | null {
  if (!totals.phosphorus_mg) return null
  return totals.calcium_mg / totals.phosphorus_mg
}
