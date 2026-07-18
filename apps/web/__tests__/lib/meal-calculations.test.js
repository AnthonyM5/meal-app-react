// Business logic tests for meal calculations and food utilities

describe('Meal Business Logic', () => {
  describe('Meal nutrition calculations', () => {
    it('should calculate total calories for a meal', () => {
      const mealItems = [
        { calories: 100, quantity: 1 },
        { calories: 200, quantity: 2 },
        { calories: 50, quantity: 3 }
      ]

      const totalCalories = mealItems.reduce((sum, item) => 
        sum + (item.calories * item.quantity), 0
      )

      expect(totalCalories).toBe(650) // 100*1 + 200*2 + 50*3
    })

    it('should calculate macronutrient totals for a meal', () => {
      const mealItems = [
        { protein_g: 10, carbs_g: 20, fat_g: 5, quantity: 2 },
        { protein_g: 15, carbs_g: 30, fat_g: 8, quantity: 1 }
      ]

      const totals = mealItems.reduce((acc, item) => ({
        protein: acc.protein + (item.protein_g * item.quantity),
        carbs: acc.carbs + (item.carbs_g * item.quantity),
        fat: acc.fat + (item.fat_g * item.quantity)
      }), { protein: 0, carbs: 0, fat: 0 })

      expect(totals).toEqual({
        protein: 35, // 10*2 + 15*1
        carbs: 70,   // 20*2 + 30*1
        fat: 18      // 5*2 + 8*1
      })
    })

    it('should handle empty meal gracefully', () => {
      const mealItems = []

      const totalCalories = mealItems.reduce((sum, item) => 
        sum + (item.calories * item.quantity), 0
      )

      expect(totalCalories).toBe(0)
    })

    it('should handle items with zero quantity', () => {
      const mealItems = [
        { calories: 100, quantity: 0 },
        { calories: 200, quantity: 1 }
      ]

      const totalCalories = mealItems.reduce((sum, item) => 
        sum + (item.calories * item.quantity), 0
      )

      expect(totalCalories).toBe(200)
    })

    it('should handle missing nutrition data', () => {
      const mealItems = [
        { calories: 100, protein_g: undefined, quantity: 1 },
        { calories: 200, protein_g: 15, quantity: 1 }
      ]

      const totalProtein = mealItems.reduce((sum, item) => 
        sum + ((item.protein_g || 0) * item.quantity), 0
      )

      expect(totalProtein).toBe(15)
    })
  })

  describe('Food portion calculations', () => {
    it('should scale nutrition values by portion size', () => {
      const food = {
        calories_per_serving: 100,
        protein_g: 20,
        carbs_g: 30,
        fat_g: 5
      }
      const portion = 2.5

      const scaledNutrition = {
        calories: food.calories_per_serving * portion,
        protein: food.protein_g * portion,
        carbs: food.carbs_g * portion,
        fat: food.fat_g * portion
      }

      expect(scaledNutrition).toEqual({
        calories: 250,
        protein: 50,
        carbs: 75,
        fat: 12.5
      })
    })

    it('should handle fractional portions', () => {
      const food = {
        calories_per_serving: 100,
        protein_g: 20
      }
      const portion = 0.5

      const scaledCalories = food.calories_per_serving * portion
      expect(scaledCalories).toBe(50)
    })

    it('should handle zero portion', () => {
      const food = {
        calories_per_serving: 100,
        protein_g: 20
      }
      const portion = 0

      const scaledCalories = food.calories_per_serving * portion
      expect(scaledCalories).toBe(0)
    })
  })

  describe('Daily nutrition tracking', () => {
    it('should calculate daily totals from multiple meals', () => {
      const meals = [
        {
          meal_type: 'breakfast',
          meal_items: [
            { calories: 200, protein_g: 10, quantity: 1 },
            { calories: 150, protein_g: 5, quantity: 1 }
          ]
        },
        {
          meal_type: 'lunch', 
          meal_items: [
            { calories: 400, protein_g: 25, quantity: 1 }
          ]
        },
        {
          meal_type: 'dinner',
          meal_items: [
            { calories: 300, protein_g: 20, quantity: 2 }
          ]
        }
      ]

      const dailyTotals = meals.reduce((totals, meal) => {
        const mealTotals = meal.meal_items?.reduce((mealSum, item) => ({
          calories: mealSum.calories + (item.calories * item.quantity),
          protein: mealSum.protein + (item.protein_g * item.quantity)
        }), { calories: 0, protein: 0 }) || { calories: 0, protein: 0 }

        return {
          calories: totals.calories + mealTotals.calories,
          protein: totals.protein + mealTotals.protein
        }
      }, { calories: 0, protein: 0 })

      expect(dailyTotals).toEqual({
        calories: 1350, // 350 + 400 + 600
        protein: 80     // 15 + 25 + 40
      })
    })

    it('should handle meals with no items', () => {
      const meals = [
        {
          meal_type: 'breakfast',
          meal_items: []
        },
        {
          meal_type: 'lunch',
          meal_items: null
        }
      ]

      const dailyTotals = meals.reduce((totals, meal) => {
        const mealTotals = meal.meal_items?.reduce((mealSum, item) => ({
          calories: mealSum.calories + (item.calories * item.quantity)
        }), { calories: 0 }) || { calories: 0 }

        return {
          calories: totals.calories + mealTotals.calories
        }
      }, { calories: 0 })

      expect(dailyTotals.calories).toBe(0)
    })
  })

  describe('Nutrition goal calculations', () => {
    it('should calculate percentage of daily goals met', () => {
      const consumed = { calories: 1500, protein: 75 }
      const goals = { calories: 2000, protein: 100 }

      const percentages = {
        calories: (consumed.calories / goals.calories) * 100,
        protein: (consumed.protein / goals.protein) * 100
      }

      expect(percentages).toEqual({
        calories: 75,
        protein: 75
      })
    })

    it('should handle exceeding goals', () => {
      const consumed = { calories: 2500 }
      const goals = { calories: 2000 }

      const percentage = (consumed.calories / goals.calories) * 100
      expect(percentage).toBe(125)
    })

    it('should handle zero goals gracefully', () => {
      const consumed = { calories: 1500 }
      const goals = { calories: 0 }

      const percentage = goals.calories === 0 ? 0 : (consumed.calories / goals.calories) * 100
      expect(percentage).toBe(0)
    })
  })
})
