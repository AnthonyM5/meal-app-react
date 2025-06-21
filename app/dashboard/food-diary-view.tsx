'use client'

import { ExploreFoodsSection } from '@/components/explore-foods-section'
import { MealSection } from '@/components/meal-section'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getTodaysMeals } from '@/lib/food-actions'
import type { Meal } from '@/lib/types'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function FoodDiaryView() {
  const [meals, setMeals] = useState<Meal[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadMeals = async () => {
    try {
      const todaysMeals = await getTodaysMeals()
      setMeals(todaysMeals)
    } catch (error) {
      console.error('Error loading meals:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadMeals()
  }, [])

  const getMealByType = (type: 'breakfast' | 'lunch' | 'dinner' | 'snack') => {
    return meals.find(meal => meal.meal_type === type)
  }

  const totalCalories = meals.reduce(
    (sum, meal) =>
      sum +
      (meal.meal_items?.reduce((mealSum, item) => mealSum + item.calories, 0) ||
        0),
    0
  )

  const totalProtein = meals.reduce(
    (sum, meal) =>
      sum +
      (meal.meal_items?.reduce(
        (mealSum, item) => mealSum + item.protein_g,
        0
      ) || 0),
    0
  )

  const totalCarbs = meals.reduce(
    (sum, meal) =>
      sum +
      (meal.meal_items?.reduce((mealSum, item) => mealSum + item.carbs_g, 0) ||
        0),
    0
  )

  const totalFat = meals.reduce(
    (sum, meal) =>
      sum +
      (meal.meal_items?.reduce((mealSum, item) => mealSum + item.fat_g, 0) ||
        0),
    0
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#161616] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Today's Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 bg-[#1c1c1c] rounded-lg">
                <div className="text-2xl font-semibold">
                  {Math.round(totalCalories)}
                </div>
                <div className="text-sm text-gray-400">Calories</div>
              </div>
              <div className="text-center p-4 bg-[#1c1c1c] rounded-lg">
                <div className="text-2xl font-semibold">
                  {Math.round(totalProtein)}g
                </div>
                <div className="text-sm text-gray-400">Protein</div>
              </div>
              <div className="text-center p-4 bg-[#1c1c1c] rounded-lg">
                <div className="text-2xl font-semibold">
                  {Math.round(totalCarbs)}g
                </div>
                <div className="text-sm text-gray-400">Carbs</div>
              </div>
              <div className="text-center p-4 bg-[#1c1c1c] rounded-lg">
                <div className="text-2xl font-semibold">
                  {Math.round(totalFat)}g
                </div>
                <div className="text-sm text-gray-400">Fat</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Meals Column */}
          <div className="space-y-4">
            <MealSection
              mealType="breakfast"
              meal={getMealByType('breakfast')}
              onUpdate={loadMeals}
            />
            <MealSection
              mealType="lunch"
              meal={getMealByType('lunch')}
              onUpdate={loadMeals}
            />
            <MealSection
              mealType="dinner"
              meal={getMealByType('dinner')}
              onUpdate={loadMeals}
            />
            <MealSection
              mealType="snack"
              meal={getMealByType('snack')}
              onUpdate={loadMeals}
            />
          </div>

          {/* Explore Foods Column */}
          <div>
            <ExploreFoodsSection />
          </div>
        </div>
      </div>
    </div>
  )
}
