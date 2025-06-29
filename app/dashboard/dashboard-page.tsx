'use client'

import { ExploreFoodsSection } from '@/components/explore-foods-section'
import { MealSection } from '@/components/meal-section'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useFoodActions } from '@/hooks/use-food-actions'
import { useGuestMode } from '@/hooks/use-guest-mode'
import type { Meal, MealType } from '@/lib/types'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function DashboardPage() {
  const [meals, setMeals] = useState<Meal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { isGuest, exitGuestMode } = useGuestMode()
  const { getTodaysMeals } = useFoodActions()

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
  }, [isGuest])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const getMeal = (type: MealType) => {
    return meals.find(meal => meal.meal_type === type)
  }

  return (
    <div className="container mx-auto p-4 space-y-4">
      {isGuest && (
        <Card>
          <CardContent className="pt-6">
            <div className="bg-muted p-4 rounded-lg text-center">
              <h3 className="font-semibold mb-2">Guest Mode</h3>
              <p className="text-sm text-muted-foreground mb-4">
                You can search and view nutrition information. Sign in to track
                meals and save favorites.
              </p>
              <Button onClick={exitGuestMode} variant="outline">
                Sign In / Create Account
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <ExploreFoodsSection />

      {!isGuest && (
        <div className="grid gap-4 md:grid-cols-2">
          <MealSection
            mealType="breakfast"
            meal={getMeal('breakfast')}
            onUpdate={loadMeals}
          />
          <MealSection
            mealType="lunch"
            meal={getMeal('lunch')}
            onUpdate={loadMeals}
          />
          <MealSection
            mealType="dinner"
            meal={getMeal('dinner')}
            onUpdate={loadMeals}
          />
          <MealSection
            mealType="snack"
            meal={getMeal('snack')}
            onUpdate={loadMeals}
          />
        </div>
      )}
    </div>
  )
}
