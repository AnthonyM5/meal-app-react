// Business logic for nutrition calculations
export function calculateNutritionTotals(foods) {
  if (!foods || foods.length === 0) {
    return {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0
    }
  }

  return foods.reduce((totals, food) => {
    const portion = food.portion || 1
    return {
      calories: totals.calories + (food.calories || 0) * portion,
      protein: totals.protein + (food.protein || 0) * portion,
      carbs: totals.carbs + (food.carbs || 0) * portion,
      fat: totals.fat + (food.fat || 0) * portion,
      fiber: totals.fiber + (food.fiber || 0) * portion,
      sugar: totals.sugar + (food.sugar || 0) * portion,
      sodium: totals.sodium + (food.sodium || 0) * portion
    }
  }, {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0
  })
}

export function validateNutritionData(nutrition) {
  const errors = []
  
  if (nutrition.calories < 0) {
    errors.push('Calories cannot be negative')
  }
  
  if (nutrition.protein < 0) {
    errors.push('Protein cannot be negative')
  }
  
  if (nutrition.carbs < 0) {
    errors.push('Carbs cannot be negative')
  }
  
  if (nutrition.fat < 0) {
    errors.push('Fat cannot be negative')
  }
  
  return errors
}
