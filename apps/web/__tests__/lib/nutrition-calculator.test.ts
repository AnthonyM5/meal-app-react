import {
  calculateDailyProgress,
  calculateNutritionTotals,
  validateNutritionData,
} from '@/lib/nutrition-calculator'

describe('Nutrition Calculator', () => {
  describe('calculateNutritionTotals', () => {
    test('returns zero totals for empty array', () => {
      const result = calculateNutritionTotals([])

      // Use basic assertions instead of Jest matchers
      if (result.calories !== 0)
        throw new Error(`Expected calories to be 0, got ${result.calories}`)
      if (result.protein !== 0)
        throw new Error(`Expected protein to be 0, got ${result.protein}`)
      if (result.carbs !== 0)
        throw new Error(`Expected carbs to be 0, got ${result.carbs}`)
      if (result.fat !== 0)
        throw new Error(`Expected fat to be 0, got ${result.fat}`)
    })

    test('calculates totals for single food item', () => {
      const foods = [
        {
          calories: 100,
          protein: 20,
          carbs: 30,
          fat: 5,
          fiber: 3,
          sugar: 10,
          sodium: 200,
        },
      ]

      const result = calculateNutritionTotals(foods)
      if (result.calories !== 100)
        throw new Error(`Expected calories to be 100, got ${result.calories}`)
      if (result.protein !== 20)
        throw new Error(`Expected protein to be 20, got ${result.protein}`)
      if (result.carbs !== 30)
        throw new Error(`Expected carbs to be 30, got ${result.carbs}`)
    })

    test('calculates totals for multiple food items', () => {
      const foods = [
        {
          calories: 100,
          protein: 20,
          carbs: 30,
          fat: 5,
          fiber: 3,
          sugar: 10,
          sodium: 200,
        },
        {
          calories: 200,
          protein: 15,
          carbs: 40,
          fat: 8,
          fiber: 5,
          sugar: 15,
          sodium: 300,
        },
      ]

      const result = calculateNutritionTotals(foods)
      if (result.calories !== 300)
        throw new Error(`Expected calories to be 300, got ${result.calories}`)
      if (result.protein !== 35)
        throw new Error(`Expected protein to be 35, got ${result.protein}`)
      if (result.carbs !== 70)
        throw new Error(`Expected carbs to be 70, got ${result.carbs}`)
    })

    test('handles portion sizes', () => {
      const foods = [{ calories: 100, protein: 20, portion: 2 }]

      const result = calculateNutritionTotals(foods)
      if (result.calories !== 200)
        throw new Error(`Expected calories to be 200, got ${result.calories}`)
      if (result.protein !== 40)
        throw new Error(`Expected protein to be 40, got ${result.protein}`)
    })
  })

  describe('validateNutritionData', () => {
    test('returns no errors for valid data', () => {
      const nutrition = {
        calories: 100,
        protein: 20,
        carbs: 30,
        fat: 5,
      }

      const errors = validateNutritionData(nutrition)
      if (errors.length !== 0)
        throw new Error(`Expected no errors, got ${errors.length}`)
    })

    test('returns errors for negative values', () => {
      const nutrition = {
        calories: -100,
        protein: -20,
        carbs: 30,
        fat: 5,
      }

      const errors = validateNutritionData(nutrition)
      if (errors.length !== 2)
        throw new Error(`Expected 2 errors, got ${errors.length}`)
      if (!errors.includes('Calories cannot be negative')) {
        throw new Error('Expected calories error not found')
      }
      if (!errors.includes('Protein cannot be negative')) {
        throw new Error('Expected protein error not found')
      }
    })
  })

  describe('calculateDailyProgress', () => {
    test('calculates progress percentage correctly', () => {
      const consumed = { calories: 1500, protein: 75 }
      const goals = { calories: 2000, protein: 100 }

      const progress = calculateDailyProgress(consumed, goals)
      if (progress.calories !== 75)
        throw new Error(
          `Expected calories progress to be 75, got ${progress.calories}`
        )
      if (progress.protein !== 75)
        throw new Error(
          `Expected protein progress to be 75, got ${progress.protein}`
        )
    })

    test('handles exceeding goals', () => {
      const consumed = { calories: 2500, protein: 120 }
      const goals = { calories: 2000, protein: 100 }

      const progress = calculateDailyProgress(consumed, goals)
      if (progress.calories !== 125)
        throw new Error(
          `Expected calories progress to be 125, got ${progress.calories}`
        )
      if (progress.protein !== 120)
        throw new Error(
          `Expected protein progress to be 120, got ${progress.protein}`
        )
    })

    test('handles zero goals gracefully', () => {
      const consumed = { calories: 1500, protein: 75 }
      const goals = { calories: 0, protein: 0 }

      const progress = calculateDailyProgress(consumed, goals)
      if (progress.calories !== 0)
        throw new Error(
          `Expected calories progress to be 0, got ${progress.calories}`
        )
      if (progress.protein !== 0)
        throw new Error(
          `Expected protein progress to be 0, got ${progress.protein}`
        )
    })
  })
})
