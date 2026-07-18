export interface NutritionData {
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
  fiber?: number
  sugar?: number
  sodium?: number
  portion?: number
}

export function calculateNutritionTotals(
  foods: NutritionData[]
): Required<Omit<NutritionData, 'portion'>> {
  return foods.reduce(
    (totals, food) => {
      const portion = food.portion || 1
      return {
        calories: totals.calories + (food.calories || 0) * portion,
        protein: totals.protein + (food.protein || 0) * portion,
        carbs: totals.carbs + (food.carbs || 0) * portion,
        fat: totals.fat + (food.fat || 0) * portion,
        fiber: totals.fiber + (food.fiber || 0) * portion,
        sugar: totals.sugar + (food.sugar || 0) * portion,
        sodium: totals.sodium + (food.sodium || 0) * portion,
      }
    },
    {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0,
    }
  )
}

export function validateNutritionData(nutrition: NutritionData): string[] {
  const errors: string[] = []

  if (nutrition.calories === undefined) {
    errors.push('Calories is required')
  } else if (nutrition.calories < 0) {
    errors.push('Calories cannot be negative')
  } else if (nutrition.calories > 5000) {
    errors.push('Calories seem unrealistically high')
  }

  if (nutrition.protein !== undefined && nutrition.protein < 0) {
    errors.push('Protein cannot be negative')
  }

  if (nutrition.carbs !== undefined && nutrition.carbs < 0) {
    errors.push('Carbs cannot be negative')
  }

  if (nutrition.fat !== undefined && nutrition.fat < 0) {
    errors.push('Fat cannot be negative')
  }

  return errors
}

export function calculateDailyProgress(
  consumed: Record<string, number>,
  goals: Record<string, number>
): Record<string, number> {
  const progress: Record<string, number> = {}

  for (const [key, value] of Object.entries(consumed)) {
    const goal = goals[key] || 0
    progress[key] = goal === 0 ? 0 : Math.round((value / goal) * 100)
  }

  return progress
}
