'use client'

import { ExploreFoodsSection } from '@/components/explore-foods-section'
import { MealSection } from '@/components/meal-section'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useFoodActions } from '@/hooks/use-food-actions'
import { supabase } from '@/lib/supabase/client'
import type { Meal } from '@/lib/types'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

export default function DashboardPage() {
  const router = useRouter()
  const [meals, setMeals] = useState<Meal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const { getTodaysMeals } = useFoodActions()

  // Simple function to check guest mode without causing re-renders
  const checkGuestMode = useCallback(() => {
    return typeof window !== 'undefined' && document.cookie.includes('guestMode=true')
  }, [])

  const exitGuestMode = useCallback(() => {
    // Clear guest mode cookie
    document.cookie = 'guestMode=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    router.push('/auth/login')
  }, [router])

  // Check auth status on mount - but prioritize guest mode
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check guest mode first - this should be the primary source of truth
        const hasGuestCookie = document.cookie.includes('guestMode=true')
        
        if (hasGuestCookie) {
          setIsAuthenticated(false)
          setIsLoading(false) // Important: set loading to false for guest mode
          return
        }

        // Only check Supabase session if not in guest mode
        const { data: { session } } = await supabase.auth.getSession()
        const hasSession = !!session
        setIsAuthenticated(hasSession)
      } catch (error) {
        console.error('Error checking auth:', error)
        setIsAuthenticated(false)
      } finally {
        setIsLoading(false)
      }
    }
    
    checkAuth()
  }, []) // Empty dependency array to run only once

  const loadMeals = useCallback(async () => {
    // Only load meals if authenticated and not in guest mode
    if (!isAuthenticated || checkGuestMode()) {
      return
    }

    try {
      const todaysMeals = await getTodaysMeals()
      setMeals(todaysMeals)
    } catch (error) {
      console.error('Error loading meals:', error)
    }
  }, [isAuthenticated, getTodaysMeals, checkGuestMode])

  useEffect(() => {
    // Only run loadMeals if we have a definitive auth state
    if (isAuthenticated !== null) {
      loadMeals()
    }
  }, [loadMeals, isAuthenticated])

  // Check guest mode directly from cookie to avoid timing issues
  const hasGuestCookie = checkGuestMode()

  // Show loading only while determining auth state AND not in guest mode
  if (isLoading && !hasGuestCookie) {
    return (
      <div className="h-[50vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }
  // Guest mode takes absolute priority - if guest cookie exists, show guest mode regardless of session
  if (hasGuestCookie) {
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
                onClick={exitGuestMode}
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

  // If not in guest mode and not authenticated, show a message instead of redirecting
  if (!isAuthenticated) {
    return (
      <div className="h-[50vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Please sign in to access the dashboard</p>
          <Button onClick={() => router.push('/auth/login')}>
            Go to Sign In
          </Button>
        </div>
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
