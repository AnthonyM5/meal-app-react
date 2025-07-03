import { calculateNutritionTotals, validateNutritionData } from '@/lib/nutrition-calculator'

describe('Nutrition Calculator', () => {
  describe('calculateNutritionTotals', () => {
    it('should return zero totals for empty array', () => {
      const result = calculateNutritionTotals([])
      expect(result).toEqual({
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodium: 0
      })
    })

    it('should calculate totals for single food item', () => {
      const foods = [
        { calories: 100, protein: 20, carbs: 30, fat: 5, fiber: 3, sugar: 10, sodium: 200 }
      ]
      
      const result = calculateNutritionTotals(foods)
      expect(result).toEqual({
        calories: 100,
        protein: 20,
        carbs: 30,
        fat: 5,
        fiber: 3,
        sugar: 10,
        sodium: 200
      })
    })

    it('should calculate totals for multiple food items', () => {
      const foods = [
        { calories: 100, protein: 20, carbs: 30, fat: 5, fiber: 3, sugar: 10, sodium: 200 },
        { calories: 200, protein: 15, carbs: 40, fat: 8, fiber: 5, sugar: 15, sodium: 300 }
      ]
      
      const result = calculateNutritionTotals(foods)
      expect(result).toEqual({
        calories: 300,
        protein: 35,
        carbs: 70,
        fat: 13,
        fiber: 8,
        sugar: 25,
        sodium: 500
      })
    })

    it('should handle portion sizes', () => {
      const foods = [
        { calories: 100, protein: 20, portion: 2 }
      ]
      
      const result = calculateNutritionTotals(foods)
      expect(result.calories).toBe(200)
      expect(result.protein).toBe(40)
    })

    it('should handle missing nutrition data', () => {
      const foods = [
        { calories: 100 }, // missing other fields
        { protein: 20 }    // missing calories
      ]
      
      const result = calculateNutritionTotals(foods)
      expect(result.calories).toBe(100)
      expect(result.protein).toBe(20)
    })
  })

  describe('validateNutritionData', () => {
    it('should return no errors for valid data', () => {
      const nutrition = {
        calories: 100,
        protein: 20,
        carbs: 30,
        fat: 5
      }
      
      const errors = validateNutritionData(nutrition)
      expect(errors).toHaveLength(0)
    })

    it('should return errors for negative values', () => {
      const nutrition = {
        calories: -100,
        protein: -20,
        carbs: 30,
        fat: 5
      }
      
      const errors = validateNutritionData(nutrition)
      expect(errors).toContain('Calories cannot be negative')
      expect(errors).toContain('Protein cannot be negative')
      expect(errors).toHaveLength(2)
    })
  })
})
