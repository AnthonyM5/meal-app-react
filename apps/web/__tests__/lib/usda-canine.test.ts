import { describe, expect, test } from '@jest/globals'
import { checkDogSafety } from '@/lib/dog-toxic-foods'
import {
  convertUSDAToIngredient,
  countExtractedNutrients,
  extractCanineNutrients,
  inferPreparationState,
  isNutritionallyUsable,
  NON_CALORIC,
  UNUSABLE_REASON,
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
    expect(nutrients.threonine_mg).toBeCloseTo(725)
    expect(nutrients.isoleucine_mg).toBeCloseTo(813)
    expect(nutrients.leucine_mg).toBeCloseTo(1512)
    expect(nutrients.valine_mg).toBeCloseTo(998)
    expect(nutrients.arginine_mg).toBeCloseTo(1093)
    expect(nutrients.histidine_mg).toBeCloseTo(507)
    // Phenylalanine 0.824 g + Tyrosine 0.653 g = 1477 mg
    expect(nutrients.phenylalanine_tyrosine_mg).toBeCloseTo(1477)
  })

  test('B-vitamins extracted', () => {
    expect(nutrients.thiamin_mg).toBeCloseTo(0.305)
    expect(nutrients.riboflavin_mg).toBeCloseTo(1.778)
    expect(nutrients.niacin_mg).toBeCloseTo(9.728)
    expect(nutrients.pantothenic_acid_mg).toBeCloseTo(6.233)
    expect(nutrients.vitamin_b6_mg).toBeCloseTo(0.853)
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

  test('sets preparation_state from the description', () => {
    expect(convertUSDAToIngredient(fixture).preparation_state).toBe('raw')
  })

  // The importer is the only surface-independent gate. `isNutritionallyUsable`
  // protects the bowl resolver and pickDefault, but NOT the search routes an
  // owner browses by hand — so a truncated payload used to land in `foods` and
  // stay pickable. scripts/030 cleaned up the 30 that got in; these keep the
  // next import from recreating them.
  describe('refuses unusable payloads at the door', () => {
    const build = (
      description: string,
      nutrients: Array<[number, number]>
    ): USDAFoodLike => ({
      fdcId: 777777,
      description,
      foodNutrients: nutrients.map(([id, amount]) => ({
        nutrient: { id, name: String(id) },
        amount,
      })),
    })

    test('deactivates an all-zero payload (the shape every oil arrived in)', () => {
      // fdc 748608 "Oil, olive, extra virgin" as USDA actually serves it:
      // 33 nutrients published, no energy and no total fat among them.
      const row = convertUSDAToIngredient(build('Oil, olive, extra virgin', []))
      expect(row.is_active).toBe(false)
      expect(row.inactive_reason).toBe(UNUSABLE_REASON)
    })

    test('deactivates a protein-only payload', () => {
      // fdc 2727584 "Leeks" — protein present, fat and carbs absent. 029 would
      // derive 5.87 kcal from this against a real 61.
      const row = convertUSDAToIngredient(
        build('Leeks, bulb and greens, root removed, raw', [[1003, 1.4675]])
      )
      expect(row.is_active).toBe(false)
      expect(row.inactive_reason).toBe(UNUSABLE_REASON)
    })

    test('admits an ordinary row with no reason set', () => {
      const row = convertUSDAToIngredient(fixture)
      expect(row.is_active).toBe(true)
      // foods_inactive_reason_check rejects a reason on an active row.
      expect(row.inactive_reason).toBeNull()
    })

    test('admits a pure fat, which is 0 protein and 0 carbs', () => {
      const row = convertUSDAToIngredient(
        build('Oil, olive, salad or cooking', [
          [1008, 884],
          [1004, 100],
        ])
      )
      expect(row.is_active).toBe(true)
      expect(row.inactive_reason).toBeNull()
    })
  })
})

describe('inferPreparationState', () => {
  test.each([
    ['Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw', 'raw'],
    ['Chicken, broilers or fryers, breast, meat only, cooked, roasted', 'cooked'],
    ['Chicken, broilers or fryers, breast, meat only, cooked, stewed', 'cooked'],
    ['Chicken, broiler, rotisserie, BBQ, breast, meat only', 'cooked'],
    ['Egg, whole, cooked, hard-boiled', 'cooked'],
    ['Beef, ground, 90% lean meat / 10% fat, patty, cooked, pan-broiled', 'cooked'],
    ['Sweet potato, cooked, baked in skin, flesh, without salt', 'cooked'],
    ['Fish, salmon, Atlantic, farmed, raw', 'raw'],
    ['Quinoa, uncooked', 'raw'],
    ['Lentils, raw', 'raw'],
  ] as const)('%s → %s', (description, expected) => {
    expect(inferPreparationState(description)).toBe(expected)
  })

  test('returns null when the description carries no signal', () => {
    expect(inferPreparationState('Salmon oil')).toBeNull()
    expect(inferPreparationState('Kelp powder (iodine supplement)')).toBeNull()
    expect(inferPreparationState('Yogurt, plain, whole milk')).toBeNull()
  })

  test('does not false-positive on words containing "raw"', () => {
    expect(inferPreparationState('Strawberries')).toBeNull()
    expect(inferPreparationState('Coleslaw dressing')).toBeNull()
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
    // Short toxic terms must not substring-match inside larger words
    ['Wheat, durum'], // "rum"
    ['Bread crumbs, dry, grated, plain'], // "rum"
    ['Pork, fresh, swine, cooked'], // "wine"
  ])('passes %s as safe', name => {
    expect(checkDogSafety(name).isSafe).toBe(true)
  })

  test('short terms still flag as whole words and plurals', () => {
    expect(checkDogSafety('Rum, 80 proof').isSafe).toBe(false)
    expect(checkDogSafety('Leeks, cooked, boiled').isSafe).toBe(false)
    expect(checkDogSafety('Wine, table, red').isSafe).toBe(false)
  })
})

// Foundation foods do not carry nutrient 1008. Reading only 1008 wrote 0 kcal
// for 245 of 4,700 live rows — 176 of them with >1 g protein, and 47 elected
// as the default variant of a canonical group. These pin the fallback chain.
describe('energy resolution across FDC report shapes', () => {
  const withNutrients = (
    entries: Array<{ id: number; amount: number }>
  ): USDAFoodLike => ({
    fdcId: 1,
    description: 'Test food, raw',
    foodNutrients: entries.map(e => ({
      nutrient: { id: e.id },
      amount: e.amount,
    })),
  })

  test('prefers 1008 when present (SR Legacy shape)', () => {
    const n = extractCanineNutrients(
      withNutrients([
        { id: 1008, amount: 148 },
        { id: 2047, amount: 999 },
        { id: 2048, amount: 888 },
      ]).foodNutrients
    )
    expect(n.calories_per_serving).toBe(148)
  })

  test('falls back to Atwater specific (2048) then general (2047)', () => {
    expect(
      extractCanineNutrients(
        withNutrients([
          { id: 2047, amount: 382.998 },
          { id: 2048, amount: 371.99469 },
        ]).foodNutrients
      ).calories_per_serving
    ).toBe(371.99469)
    // 2047 alone still resolves — it covers more of the corpus than 2048.
    expect(
      extractCanineNutrients(
        withNutrients([{ id: 2047, amount: 382.998 }]).foodNutrients
      ).calories_per_serving
    ).toBe(382.998)
  })

  test('derives 4/4/9 from macros when no energy nutrient exists at all', () => {
    // Real shape: "Beans, Dry, Dark Red Kidney" — macros, zero energy rows.
    const n = extractCanineNutrients(
      withNutrients([
        { id: 1003, amount: 25.9 }, // protein
        { id: 1005, amount: 10 }, // carbs
        { id: 1004, amount: 1.31 }, // fat
      ]).foodNutrients
    )
    expect(n.calories_per_serving).toBeCloseTo(25.9 * 4 + 10 * 4 + 1.31 * 9, 2)
  })

  test('stays 0 when the record states no energy and no macros', () => {
    // Preserved rather than guessed — these 18 rows need a re-fetch.
    expect(
      extractCanineNutrients(withNutrients([{ id: 1087, amount: 20 }]).foodNutrients)
        .calories_per_serving
    ).toBe(0)
  })

  test('a zero energy value never wins over a real one', () => {
    // FDC does emit explicit 0 amounts; treating that as "present" was the
    // bug's twin — it would pin the row at 0 despite 2047 carrying a value.
    expect(
      extractCanineNutrients(
        withNutrients([
          { id: 1008, amount: 0 },
          { id: 2047, amount: 382.998 },
        ]).foodNutrients
      ).calories_per_serving
    ).toBe(382.998)
  })
})

describe('isNutritionallyUsable', () => {
  test('rejects the physically impossible: 0 kcal carrying macros', () => {
    // The live chickpea row an owner actually got served.
    expect(
      isNutritionallyUsable({
        calories_per_serving: 0,
        protein_g: 21.28,
        fat_g: 6.27,
        carbs_g: 60.36,
      })
    ).toBe(false)
  })

  test('accepts ordinary rows', () => {
    expect(
      isNutritionallyUsable({
        calories_per_serving: 148,
        protein_g: 19.66,
        fat_g: 4.83,
        carbs_g: 0.73,
      })
    ).toBe(true)
  })

  // Rule 1. scripts/029 derived energy from protein alone on ~12 Foundation
  // rows whose payload omitted fat and carbohydrate entirely. The results sit
  // above zero, so the old predicate's `kcal > 0` shortcut accepted them —
  // the backfill turned correctly-refused rows into silently wrong ones.
  describe('truncated payload: protein with no fat and no carbs', () => {
    test('rejects the live leeks row (5.87 kcal against a real 61)', () => {
      expect(
        isNutritionallyUsable({
          calories_per_serving: 5.87,
          protein_g: 1.4675,
          fat_g: 0,
          carbs_g: 0,
        })
      ).toBe(false)
    })

    test('rejects it even though energy is positive', () => {
      // Guards the ordering: testing kcal > 0 first would pass this through.
      expect(
        isNutritionallyUsable({
          calories_per_serving: 1.69,
          protein_g: 0.42,
          fat_g: 0,
          carbs_g: 0,
        })
      ).toBe(false)
    })

    test('accepts lean meat, which is 0 carbs but never 0 fat', () => {
      // Chicken breast, boneless, skinless, raw — the shape rule 1 must not
      // catch. Verified against all 4,700 active rows: no legitimate food has
      // protein while both fat and carbohydrate are exactly zero.
      expect(
        isNutritionallyUsable({
          calories_per_serving: 112,
          protein_g: 22.5,
          fat_g: 2.6,
          carbs_g: 0,
        })
      ).toBe(true)
    })

    test('accepts a pure fat, which is 0 protein and 0 carbs', () => {
      expect(
        isNutritionallyUsable({
          calories_per_serving: 884,
          protein_g: 0,
          fat_g: 100,
          carbs_g: 0,
        })
      ).toBe(true)
    })
  })

  // Rule 3. All-zero is legitimate for a supplement and wrong for everything
  // else, and the numbers cannot tell them apart — so it must be asserted.
  describe('all-zero rows must be marked', () => {
    test('accepts eggshell powder, which declares its zeros', () => {
      expect(
        isNutritionallyUsable({
          calories_per_serving: 0,
          protein_g: 0,
          fat_g: 0,
          carbs_g: 0,
          data_completeness: NON_CALORIC,
        })
      ).toBe(true)
    })

    test('rejects an unmarked all-zero row', () => {
      // "Oil, peanut" as USDA publishes it: all zero, and 100% fat in reality.
      expect(
        isNutritionallyUsable({
          calories_per_serving: 0,
          protein_g: 0,
          fat_g: 0,
          carbs_g: 0,
        })
      ).toBe(false)
    })

    test('rejects an all-zero row marked with some other completeness', () => {
      expect(
        isNutritionallyUsable({
          calories_per_serving: 0,
          protein_g: 0,
          fat_g: 0,
          carbs_g: 0,
          data_completeness: 'sparse',
        })
      ).toBe(false)
    })

    test('fails closed on an empty row', () => {
      // A caller that forgot to SELECT the nutrition columns gets "unusable",
      // not "fine". Nulls are indistinguishable from measured zeros here.
      expect(isNutritionallyUsable({})).toBe(false)
    })
  })
})
