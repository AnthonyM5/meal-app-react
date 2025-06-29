'use client'

import { ExploreFoodsSection } from '@/components/explore-foods-section'
import { MealSection } from '@/components/meal-section'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useFoodActions } from '@/hooks/use-food-actions'
import { useGuestMode } from '@/hooks/use-guest-mode'
import type { Meal } from '@/lib/types'
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

export default function DashboardPage() {
  const [meals, setMeals] = useState<Meal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { isGuest, exitGuestMode } = useGuestMode()
  const { getTodaysMeals } = useFoodActions()

  const loadMeals = useCallback(async () => {
    if (isGuest) {
      setIsLoading(false)
      return
    }

    try {
      const todaysMeals = await getTodaysMeals()
      setMeals(todaysMeals)
    } catch (error) {
      console.error('Error loading meals:', error)
    } finally {
      setIsLoading(false)
    }
  }, [isGuest, getTodaysMeals])

  useEffect(() => {
    loadMeals()
  }, [loadMeals])

  if (isLoading) {
    return (
      <div className="h-[50vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  // For guest users, only show the explore section with guest banner
  if (isGuest) {
    return (
      <div className="space-y-8 pb-8">
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-yellow-500">
                You're viewing in guest mode. Sign in to track meals and save
                favorites.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  exitGuestMode()
                  window.location.href = '/auth/login'
                }}
              >
                Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
        <ExploreFoodsSection />
      </div>
    )
  }

  // For authenticated users, show the full dashboard
  return (
    <div className="space-y-8 pb-8">
      <div className="grid gap-8 grid-cols-1 md:grid-cols-2">
        <div className="space-y-8">
          <MealSection
            mealType="breakfast"
            meal={meals.find(meal => meal.meal_type === 'breakfast')}
            onUpdate={loadMeals}
          />
          <MealSection
            mealType="lunch"
            meal={meals.find(meal => meal.meal_type === 'lunch')}
            onUpdate={loadMeals}
          />
          <MealSection
            mealType="dinner"
            meal={meals.find(meal => meal.meal_type === 'dinner')}
            onUpdate={loadMeals}
          />
          <MealSection
            mealType="snack"
            meal={meals.find(meal => meal.meal_type === 'snack')}
            onUpdate={loadMeals}
          />
        </div>
        <div className="space-y-8">
          <ExploreFoodsSection />
        </div>
      </div>
    </div>
  )
}
