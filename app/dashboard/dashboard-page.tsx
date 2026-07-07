'use client'

import { DogForm } from '@/components/dog-form'
import { DogMealBuilder } from '@/components/dog-meal-builder'
import { ExploreFoodsSection } from '@/components/explore-foods-section'
import { NutrientGapBars } from '@/components/nutrient-gap-bars'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getUserDogs } from '@/lib/dog-actions'
import {
  deleteDogMeal,
  getDogDailyGaps,
  getDogMeals,
  type DogMealSummary,
} from '@/lib/meal-actions'
import { supabase } from '@/lib/supabase/client'
import type { Dog } from '@/lib/types'
import {
  AlertTriangle,
  Dog as DogIcon,
  Loader2,
  Plus,
  Stethoscope,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

type DailyGaps = Awaited<ReturnType<typeof getDogDailyGaps>>

export default function DashboardPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  // Determined client-side in an effect to avoid a hydration mismatch
  const [isGuestUser, setIsGuestUser] = useState(false)
  const [dogs, setDogs] = useState<Dog[]>([])
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null)
  const [dailyGaps, setDailyGaps] = useState<DailyGaps | null>(null)
  const [meals, setMeals] = useState<DogMealSummary[]>([])
  const [isLoadingDay, setIsLoadingDay] = useState(false)
  const [deletingMealId, setDeletingMealId] = useState<string | null>(null)

  // Simple function to check guest mode without causing re-renders
  const checkGuestMode = useCallback(() => {
    return (
      typeof window !== 'undefined' &&
      document.cookie.includes('guestMode=true')
    )
  }, [])

  const exitGuestMode = useCallback(() => {
    document.cookie = 'guestMode=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    router.push('/auth/login')
  }, [router])

  // Check auth status on mount - but prioritize guest mode
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const hasGuestCookie = document.cookie.includes('guestMode=true')
        if (hasGuestCookie) {
          setIsGuestUser(true)
          setIsAuthenticated(false)
          setIsLoading(false)
          return
        }

        const {
          data: { session },
        } = await supabase.auth.getSession()
        setIsAuthenticated(!!session)
      } catch (error) {
        console.error('Error checking auth:', error)
        setIsAuthenticated(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const loadDogs = useCallback(async () => {
    if (!isAuthenticated || checkGuestMode()) return
    try {
      const userDogs = await getUserDogs()
      setDogs(userDogs)
      setSelectedDogId(prev =>
        prev && userDogs.some(dog => dog.id === prev)
          ? prev
          : userDogs[0]?.id ?? null
      )
    } catch (error) {
      console.error('Error loading dogs:', error)
      toast.error('Failed to load your dogs')
    }
  }, [isAuthenticated, checkGuestMode])

  useEffect(() => {
    if (isAuthenticated !== null) {
      loadDogs()
    }
  }, [loadDogs, isAuthenticated])

  const loadDay = useCallback(async () => {
    if (!selectedDogId) {
      setDailyGaps(null)
      setMeals([])
      return
    }
    setIsLoadingDay(true)
    try {
      const [gaps, dogMeals] = await Promise.all([
        getDogDailyGaps(selectedDogId),
        getDogMeals(selectedDogId),
      ])
      setDailyGaps(gaps)
      setMeals(dogMeals)
    } catch (error) {
      console.error('Error loading daily gaps:', error)
      toast.error("Failed to load today's nutrition")
    } finally {
      setIsLoadingDay(false)
    }
  }, [selectedDogId])

  useEffect(() => {
    loadDay()
  }, [loadDay])

  const handleDeleteMeal = async (mealId: string) => {
    setDeletingMealId(mealId)
    try {
      await deleteDogMeal(mealId)
      toast.success('Meal removed')
      await loadDay()
    } catch (error) {
      console.error('Delete meal error:', error)
      toast.error('Failed to delete meal')
    } finally {
      setDeletingMealId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  // Guest mode takes absolute priority - if guest cookie exists, show guest mode regardless of session
  if (isGuestUser) {
    return (
      <div className="space-y-8 pb-8">
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-yellow-500">
                You&apos;re viewing in guest mode. Sign in to add your dogs and
                track their meals.
              </p>
              <Button variant="outline" size="sm" onClick={exitGuestMode}>
                Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
        <ExploreFoodsSection />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="space-y-4 text-center">
          <p className="text-muted-foreground">
            Please sign in to access the dashboard
          </p>
          <Button onClick={() => router.push('/auth/login')}>
            Go to Sign In
          </Button>
        </div>
      </div>
    )
  }

  const selectedDog = dogs.find(dog => dog.id === selectedDogId) ?? null

  if (dogs.length === 0) {
    return (
      <div className="flex h-[60vh] items-center justify-center pb-8">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <DogIcon className="h-12 w-12 text-muted-foreground" />
            <div>
              <p className="font-semibold">Welcome to PawPlate</p>
              <p className="text-sm text-muted-foreground">
                Add your dog to get daily feeding targets and start logging
                meals.
              </p>
            </div>
            <DogForm
              trigger={
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add your dog
                </Button>
              }
              onSaved={loadDogs}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Select
            value={selectedDogId ?? undefined}
            onValueChange={setSelectedDogId}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select a dog" />
            </SelectTrigger>
            <SelectContent>
              {dogs.map(dog => (
                <SelectItem key={dog.id} value={dog.id}>
                  {dog.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isLoadingDay && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <Button variant="outline" asChild>
          <Link href="/dogs">Manage dogs</Link>
        </Button>
      </div>

      {dailyGaps && dailyGaps.unsafeIngredients.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unsafe ingredients logged today</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc pl-4">
              {dailyGaps.unsafeIngredients.map(ing => (
                <li key={ing.id}>
                  <span className="font-medium">{ing.name}</span>
                  {ing.toxicity_note ? ` — ${ing.toxicity_note}` : ''}
                </li>
              ))}
            </ul>
            <p className="mt-2">
              Contact your veterinarian or the ASPCA Animal Poison Control
              Center if your dog ate these.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {dailyGaps?.requiresVetNotice && selectedDog && (
        <Alert>
          <Stethoscope className="h-4 w-4" />
          <AlertTitle>Consult your vet</AlertTitle>
          <AlertDescription>
            {selectedDog.name} has recorded health conditions (
            {selectedDog.health_conditions.join(', ')}). These targets are for
            healthy dogs — check any diet changes with your veterinarian.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-6">
          {selectedDog && dailyGaps && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  {selectedDog.name}&apos;s day
                </CardTitle>
                <CardDescription>
                  {Math.round(dailyGaps.totalKcal)} of{' '}
                  {Math.round(dailyGaps.dailyKcal)} kcal target
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(
                        (dailyGaps.totalKcal / dailyGaps.dailyKcal) * 100,
                        100
                      )}%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {selectedDogId && (
            <DogMealBuilder dogId={selectedDogId} onMealLogged={loadDay} />
          )}

          {meals.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Today&apos;s meals</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {meals.map(meal => (
                    <li
                      key={meal.id}
                      className="flex items-start justify-between gap-2 rounded-md border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium capitalize">
                          {meal.name || meal.meal_type} ·{' '}
                          {Math.round(meal.calories)} kcal
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {meal.items
                            .map(item => `${item.name} (${item.grams} g)`)
                            .join(', ')}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteMeal(meal.id)}
                        disabled={deletingMealId === meal.id}
                        aria-label="Delete meal"
                      >
                        {deletingMealId === meal.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Nutrient coverage</CardTitle>
            <CardDescription>
              Today&apos;s intake vs. AAFCO daily targets
              {selectedDog ? ` for ${selectedDog.name}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dailyGaps ? (
              <NutrientGapBars gaps={dailyGaps.gaps} />
            ) : (
              <p className="text-sm text-muted-foreground">
                {isLoadingDay ? 'Loading…' : 'Select a dog to see coverage.'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
