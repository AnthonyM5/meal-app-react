import { describe, expect, test } from '@jest/globals'
import {
  calciumPhosphorusRatio,
  calculateDailyProgress,
  computeGaps,
  computeMealNutrients,
  computeTargets,
  dailyEnergyForDog,
  dailyEnergyRequirement,
  findUnsafeIngredients,
  merFactor,
  requirementLifeStage,
  restingEnergyRequirement,
  TRACKED_NUTRIENTS,
  type DogEnergyInputs,
} from '@/lib/canine-nutrition'
import type { Ingredient, NutrientRequirement } from '@/lib/types'

const makeIngredient = (overrides: Partial<Ingredient>): Ingredient => ({
  id: 'ing-1',
  name: 'Test ingredient',
  serving_size: 100,
  serving_unit: 'g',
  calories_per_serving: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  fiber_g: 0,
  is_verified: true,
  ...overrides,
})

const adultDog: DogEnergyInputs = {
  weightKg: 10,
  lifeStage: 'adult',
  activityLevel: 'moderately_active',
  neutered: true,
}

const makeRequirement = (
  overrides: Partial<NutrientRequirement>
): NutrientRequirement => ({
  id: 'req-1',
  nutrient_key: 'protein_g',
  life_stage: 'adult',
  amount_per_1000kcal: 45,
  unit: 'g',
  min_value: 45,
  max_value: null,
  source: 'AAFCO 2016',
  ...overrides,
})

describe('restingEnergyRequirement', () => {
  test('matches the known value for a 10 kg dog (~394 kcal)', () => {
    expect(restingEnergyRequirement(10)).toBeCloseTo(70 * Math.pow(10, 0.75), 5)
    expect(restingEnergyRequirement(10)).toBeCloseTo(393.6, 0)
  })

  test('throws on non-positive weight', () => {
    expect(() => restingEnergyRequirement(0)).toThrow()
    expect(() => restingEnergyRequirement(-5)).toThrow()
  })
})

describe('merFactor', () => {
  test('neutered adult, moderate activity = 1.6', () => {
    expect(merFactor(adultDog)).toBe(1.6)
  })

  test('intact adult, moderate activity = 1.8', () => {
    expect(merFactor({ ...adultDog, neutered: false })).toBe(1.8)
  })

  test('working adult = 3.0', () => {
    expect(merFactor({ ...adultDog, activityLevel: 'working' })).toBe(3.0)
  })

  test('young puppy (<4 months) = 3.0, older puppy = 2.0', () => {
    expect(merFactor({ ...adultDog, lifeStage: 'puppy', ageMonths: 2 })).toBe(3.0)
    expect(merFactor({ ...adultDog, lifeStage: 'puppy', ageMonths: 8 })).toBe(2.0)
    expect(merFactor({ ...adultDog, lifeStage: 'puppy' })).toBe(2.0)
  })

  test('lactating = 3.0', () => {
    expect(merFactor({ ...adultDog, lifeStage: 'lactating' })).toBe(3.0)
  })
})

describe('dailyEnergyForDog', () => {
  test('normal-weight dog uses RER * MER factor', () => {
    expect(dailyEnergyForDog(adultDog)).toBeCloseTo(
      dailyEnergyRequirement(10, 1.6),
      5
    )
  })

  test('overweight dog gets 1.0 x RER of ideal weight', () => {
    const chunky = { ...adultDog, weightKg: 14, idealWeightKg: 10 }
    expect(dailyEnergyForDog(chunky)).toBeCloseTo(restingEnergyRequirement(10), 5)
  })
})

describe('computeMealNutrients', () => {
  test('empty meal returns all zeros', () => {
    const totals = computeMealNutrients([])
    expect(totals.calories).toBe(0)
    for (const key of TRACKED_NUTRIENTS) expect(totals[key]).toBe(0)
  })

  test('single ingredient scales by grams / serving size', () => {
    const chicken = makeIngredient({
      calories_per_serving: 120,
      protein_g: 22.5,
      calcium_mg: 5,
      taurine_mg: 18,
    })
    const totals = computeMealNutrients([{ grams: 200, ingredient: chicken }])
    expect(totals.calories).toBeCloseTo(240)
    expect(totals.protein_g).toBeCloseTo(45)
    expect(totals.calcium_mg).toBeCloseTo(10)
    expect(totals.taurine_mg).toBeCloseTo(36)
  })

  test('multiple ingredients sum (hand-computed reference meal)', () => {
    const chickenThigh = makeIngredient({
      calories_per_serving: 121,
      protein_g: 19.7,
      fat_g: 4.7,
      phosphorus_mg: 185,
      calcium_mg: 9,
    })
    const rice = makeIngredient({
      calories_per_serving: 112,
      protein_g: 2.3,
      carbs_g: 23.5,
      phosphorus_mg: 77,
      calcium_mg: 10,
    })
    // 150 g thigh + 50 g rice, computed by hand:
    // kcal:  121*1.5 + 112*0.5 = 181.5 + 56 = 237.5
    // prot:  19.7*1.5 + 2.3*0.5 = 29.55 + 1.15 = 30.7
    // phos:  185*1.5 + 77*0.5 = 277.5 + 38.5 = 316
    // ca:    9*1.5 + 10*0.5 = 13.5 + 5 = 18.5
    const totals = computeMealNutrients([
      { grams: 150, ingredient: chickenThigh },
      { grams: 50, ingredient: rice },
    ])
    expect(totals.calories).toBeCloseTo(237.5)
    expect(totals.protein_g).toBeCloseTo(30.7)
    expect(totals.phosphorus_mg).toBeCloseTo(316)
    expect(totals.calcium_mg).toBeCloseTo(18.5)
  })

  test('missing nutrient columns are treated as zero', () => {
    const bare = makeIngredient({ calories_per_serving: 50 })
    const totals = computeMealNutrients([{ grams: 100, ingredient: bare }])
    expect(totals.taurine_mg).toBe(0)
    expect(totals.vitamin_d_iu).toBe(0)
  })
})

describe('requirementLifeStage', () => {
  test('maps reproduction stages to the growth profile', () => {
    expect(requirementLifeStage('pregnant')).toBe('puppy')
    expect(requirementLifeStage('lactating')).toBe('puppy')
    expect(requirementLifeStage('senior')).toBe('adult')
    expect(requirementLifeStage('adult')).toBe('adult')
    expect(requirementLifeStage('puppy')).toBe('puppy')
  })
})

describe('computeTargets', () => {
  test('scales per-1000-kcal requirement by daily energy', () => {
    const { dailyKcal, targets } = computeTargets(adultDog, [makeRequirement({})])
    // 10 kg neutered adult: 393.6 * 1.6 ≈ 629.8 kcal
    expect(dailyKcal).toBeCloseTo(629.8, 0)
    expect(targets.protein_g?.dailyTarget).toBeCloseTo(45 * (dailyKcal / 1000), 5)
  })

  test('null amount (taurine) yields null target', () => {
    const { targets } = computeTargets(adultDog, [
      makeRequirement({
        nutrient_key: 'taurine_mg',
        amount_per_1000kcal: null,
        min_value: null,
        unit: 'mg',
        source: 'PawPlate editorial',
      }),
    ])
    expect(targets.taurine_mg?.dailyTarget).toBeNull()
  })

  test('ignores requirements for other life stages', () => {
    const { targets } = computeTargets(adultDog, [
      makeRequirement({ life_stage: 'puppy' }),
    ])
    expect(targets.protein_g).toBeUndefined()
  })
})

describe('computeGaps', () => {
  const requirements: NutrientRequirement[] = [
    makeRequirement({}),
    makeRequirement({
      id: 'req-vd',
      nutrient_key: 'vitamin_d_iu',
      amount_per_1000kcal: 125,
      unit: 'IU',
      min_value: 125,
      max_value: 750,
    }),
    makeRequirement({
      id: 'req-tau',
      nutrient_key: 'taurine_mg',
      amount_per_1000kcal: null,
      min_value: null,
      unit: 'mg',
      source: 'PawPlate editorial',
    }),
  ]
  const dogTargets = computeTargets(adultDog, requirements)
  const kcalFactor = dogTargets.dailyKcal / 1000

  const totalsWith = (overrides: Partial<Record<string, number>>) => {
    const totals = computeMealNutrients([])
    return Object.assign(totals, overrides)
  }

  test('deficient below 90% of target', () => {
    const gaps = computeGaps(
      totalsWith({ protein_g: 45 * kcalFactor * 0.5 }),
      dogTargets
    )
    expect(gaps.protein_g?.status).toBe('deficient')
    expect(gaps.protein_g?.pct).toBeCloseTo(50, 0)
  })

  test('adequate near target', () => {
    const gaps = computeGaps(
      totalsWith({ protein_g: 45 * kcalFactor }),
      dogTargets
    )
    expect(gaps.protein_g?.status).toBe('adequate')
    expect(gaps.protein_g?.pct).toBeCloseTo(100, 0)
  })

  test('excess above 150% of target without a max', () => {
    const gaps = computeGaps(
      totalsWith({ protein_g: 45 * kcalFactor * 2 }),
      dogTargets
    )
    expect(gaps.protein_g?.status).toBe('excess')
  })

  test('toxic_risk when above the scaled safe max (vitamin D)', () => {
    const gaps = computeGaps(
      totalsWith({ vitamin_d_iu: 750 * kcalFactor * 1.2 }),
      dogTargets
    )
    expect(gaps.vitamin_d_iu?.status).toBe('toxic_risk')
  })

  test('below the max stays non-toxic (vitamin D)', () => {
    const gaps = computeGaps(
      totalsWith({ vitamin_d_iu: 125 * kcalFactor }),
      dogTargets
    )
    expect(gaps.vitamin_d_iu?.status).toBe('adequate')
  })

  test('no-RDA nutrient is informational', () => {
    const gaps = computeGaps(totalsWith({ taurine_mg: 50 }), dogTargets)
    expect(gaps.taurine_mg?.status).toBe('informational')
    expect(gaps.taurine_mg?.pct).toBeNull()
  })

  test('empty meal is deficient across formal targets', () => {
    const gaps = computeGaps(computeMealNutrients([]), dogTargets)
    expect(gaps.protein_g?.status).toBe('deficient')
    expect(gaps.vitamin_d_iu?.status).toBe('deficient')
  })
})

describe('calculateDailyProgress', () => {
  test('produces a rounded percent map keyed by nutrient', () => {
    const dogTargets = computeTargets(adultDog, [makeRequirement({})])
    const totals = computeMealNutrients([])
    totals.protein_g = (dogTargets.targets.protein_g?.dailyTarget ?? 0) * 0.75
    const progress = calculateDailyProgress(computeGaps(totals, dogTargets))
    expect(progress.protein_g).toBe(75)
  })
})

describe('safety helpers', () => {
  test('findUnsafeIngredients flags toxic items', () => {
    const onion = makeIngredient({
      name: 'Onion, raw',
      is_safe_for_dogs: false,
      toxicity_note: 'Heinz-body hemolytic anemia',
    })
    const chicken = makeIngredient({ name: 'Chicken', is_safe_for_dogs: true })
    const unsafe = findUnsafeIngredients([
      { grams: 10, ingredient: onion },
      { grams: 100, ingredient: chicken },
    ])
    expect(unsafe).toHaveLength(1)
    expect(unsafe[0].name).toBe('Onion, raw')
  })

  test('calciumPhosphorusRatio computes Ca:P', () => {
    const totals = computeMealNutrients([])
    totals.calcium_mg = 1200
    totals.phosphorus_mg = 1000
    expect(calciumPhosphorusRatio(totals)).toBeCloseTo(1.2)
    expect(calciumPhosphorusRatio(computeMealNutrients([]))).toBeNull()
  })
})
