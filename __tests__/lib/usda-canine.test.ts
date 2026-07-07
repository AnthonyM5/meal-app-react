import { describe, expect, test } from '@jest/globals'
import { checkDogSafety } from '@/lib/dog-toxic-foods'
import {
  convertUSDAToIngredient,
  countExtractedNutrients,
  extractCanineNutrients,
  type USDAFoodLike,
} from '@/lib/usda-canine'
// Captured live from FDC on 2026-07-06: GET /v1/food/171060?format=full
// ("Chicken, liver, all classes, raw", SR Legacy)
import chickenLiverFixture from '../fixtures/usda-chicken-liver-171060.json'

const fixture = chickenLiverFixture as unknown as USDAFoodLike

describe('extractCanineNutrients (against captured USDA fixture)', () => {
  const nutrients = extractCanineNutrients(fixture.foodNutrients)

  test('macros match the published SR Legacy values', () => {
    expect(nutrients.calories_per_serving).toBeCloseTo(119)
    expect(nutrients.protein_g).toBeCloseTo(16.92)
    expect(nutrients.fat_g).toBeCloseTo(4.83)
    expect(nutrients.carbs_g).toBeCloseTo(0.73)
  })

  test('canine-critical minerals extracted', () => {
    expect(nutrients.phosphorus_mg).toBeCloseTo(297)
    expect(nutrients.calcium_mg).toBeCloseTo(8)
    expect(nutrients.copper_mg).toBeCloseTo(0.492)
    expect(nutrients.manganese_mg).toBeCloseTo(0.255)
    expect(nutrients.zinc_mg).toBeCloseTo(2.67)
    expect(nutrients.selenium_mcg).toBeCloseTo(54.6)
    expect(nutrients.magnesium_mg).toBeCloseTo(19)
  })

  test('vitamins extracted (A as RAE, D as IU)', () => {
    expect(nutrients.vitamin_a_mcg).toBeCloseTo(3296)
    expect(nutrients.vitamin_d_iu).toBeCloseTo(0)
    expect(nutrients.vitamin_b12_mcg).toBeCloseTo(16.58)
    expect(nutrients.folate_mcg).toBeCloseTo(588)
    expect(nutrients.choline_mg).toBeCloseTo(194.4)
    expect(nutrients.vitamin_e_mg).toBeCloseTo(0.7)
  })

  test('amino acids converted g -> mg (methionine + cystine summed)', () => {
    // Methionine 0.432 g + Cystine 0.272 g = 704 mg
    expect(nutrients.methionine_cystine_mg).toBeCloseTo(704)
    expect(nutrients.lysine_mg).toBeCloseTo(1332)
    expect(nutrients.tryptophan_mg).toBeCloseTo(176)
  })

  test('fatty acids: EPA+DHA summed, LA prefers the n-6 isomer', () => {
    expect(nutrients.omega3_epa_dha_mg).toBeCloseTo(0)
    // PUFA 18:2 n-6 c,c = 0.475 g -> 475 mg
    expect(nutrients.omega6_la_mg).toBeCloseTo(475)
  })

  test('well over 15 tracked nutrients present in a SR Legacy food', () => {
    expect(countExtractedNutrients(fixture.foodNutrients)).toBeGreaterThanOrEqual(
      15
    )
  })

  test('handles the flat search-result shape too', () => {
    const flat = [
      { nutrientId: 1003, nutrientName: 'Protein', value: 20, unitName: 'G' },
      { nutrientId: 1091, nutrientName: 'Phosphorus, P', value: 200, unitName: 'MG' },
    ]
    const result = extractCanineNutrients(flat)
    expect(result.protein_g).toBe(20)
    expect(result.phosphorus_mg).toBe(200)
  })

  test('vitamin D falls back to mcg * 40 when the IU nutrient is absent', () => {
    const result = extractCanineNutrients([
      { nutrient: { id: 1114, name: 'Vitamin D (D2 + D3)' }, amount: 2.5 },
    ])
    expect(result.vitamin_d_iu).toBeCloseTo(100)
  })
})

describe('convertUSDAToIngredient', () => {
  test('produces a complete verified row for chicken liver', () => {
    const row = convertUSDAToIngredient(fixture)
    expect(row.fdc_id).toBe(171060)
    expect(row.name).toBe('Chicken, liver, all classes, raw')
    expect(row.serving_size).toBe(100)
    expect(row.serving_unit).toBe('g')
    expect(row.is_safe_for_dogs).toBe(true)
    expect(row.toxicity_note).toBeNull()
    expect(row.is_verified).toBe(true)
  })

  test('flags toxic ingredients on import (onion)', () => {
    const onion: USDAFoodLike = {
      fdcId: 999999,
      description: 'Onions, raw',
      foodNutrients: [
        { nutrient: { id: 1008, name: 'Energy' }, amount: 40 },
      ],
    }
    const row = convertUSDAToIngredient(onion)
    expect(row.is_safe_for_dogs).toBe(false)
    expect(row.toxicity_note).toMatch(/hemolytic anemia/i)
  })

  test('sparse profiles are marked unverified', () => {
    const sparse: USDAFoodLike = {
      fdcId: 888888,
      description: 'Mystery snack',
      foodNutrients: [
        { nutrient: { id: 1008, name: 'Energy' }, amount: 100 },
        { nutrient: { id: 1003, name: 'Protein' }, amount: 5 },
      ],
    }
    expect(convertUSDAToIngredient(sparse).is_verified).toBe(false)
  })
})

describe('checkDogSafety', () => {
  test.each([
    ['Onions, raw'],
    ['Garlic powder'],
    ['Grapes, red, seedless'],
    ['Raisins, golden'],
    ['Chocolate, dark, 70-85% cacao'],
    ['Macadamia nuts, roasted'],
    ['Chewing gum with xylitol'],
    ['Leeks, cooked'],
    ['Chives, freeze-dried'],
  ])('flags %s as unsafe', name => {
    const result = checkDogSafety(name)
    expect(result.isSafe).toBe(false)
    expect(result.note).toBeTruthy()
  })

  test.each([
    ['Chicken, liver, all classes, raw'],
    ['Rice, brown, cooked'],
    ['Pumpkin, cooked, mashed'],
    ['Egg, whole, raw'],
  ])('passes %s as safe', name => {
    expect(checkDogSafety(name).isSafe).toBe(true)
  })
})
