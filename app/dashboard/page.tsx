"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MealSection } from "@/components/meal-section"
import { getTodaysMeals } from "@/lib/food-actions"
import type { Meal } from "@/lib/types"
import { Loader2 } from "lucide-react"

export default function DashboardPage() {
  const [meals, setMeals] = useState<Meal[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadMeals = async () => {
    try {
      const todaysMeals = await getTodaysMeals()
      setMeals(todaysMeals)
    } catch (error) {
      console.error("Error loading meals:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadMeals()
  }, [])

  const getMealByType = (type: "breakfast" | "lunch" | "dinner" | "snack") => {
    return meals.find((meal) => meal.meal_type === type)
  }

  const totalCalories = meals.reduce(
    (sum, meal) => sum + (meal.meal_items?.reduce((mealSum, item) => mealSum + item.calories, 0) || 0),
    0,
  )
  const totalProtein = meals.reduce(
    (sum, meal) => sum + (meal.meal_items?.reduce((mealSum, item) => mealSum + item.protein_g, 0) || 0),
    0,
  )
  const totalCarbs = meals.reduce(
    (sum, meal) => sum + (meal.meal_items?.reduce((mealSum, item) => mealSum + item.carbs_g, 0) || 0),
    0,
  )
  const totalFat = meals.reduce(
    (sum, meal) => sum + (meal.meal_items?.reduce((mealSum, item) => mealSum + item.fat_g, 0) || 0),
    0,
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Food Diary</h1>
        <p className="text-muted-foreground">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Daily Summary */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Today's Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{Math.round(totalCalories)}</div>
              <div className="text-sm text-muted-foreground">Calories</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{Math.round(totalProtein)}g</div>
              <div className="text-sm text-muted-foreground">Protein</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{Math.round(totalCarbs)}g</div>
              <div className="text-sm text-muted-foreground">Carbs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{Math.round(totalFat)}g</div>
              <div className="text-sm text-muted-foreground">Fat</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Meals */}
      <div className="space-y-4">
        <MealSection mealType="breakfast" meal={getMealByType("breakfast")} onUpdate={loadMeals} />
        <MealSection mealType="lunch" meal={getMealByType("lunch")} onUpdate={loadMeals} />
        <MealSection mealType="dinner" meal={getMealByType("dinner")} onUpdate={loadMeals} />
        <MealSection mealType="snack" meal={getMealByType("snack")} onUpdate={loadMeals} />
      </div>
    </div>
  )
}
