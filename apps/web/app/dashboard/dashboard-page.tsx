'use client'

import { DogForm } from '@/components/dog-form'
import { DogMealBuilder } from '@/components/dog-meal-builder'
import { ExploreFoodsSection } from '@/components/explore-foods-section'
import { MealCalendar } from '@/components/meal-calendar'
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
  getDogMealForEdit,
  getDogMeals,
  type DogMealForEdit,
  type DogMealResult,
  type DogMealSummary,
} from '@/lib/meal-actions'
import { supabase } from '@/lib/supabase/client'
import type { Dog } from '@/lib/types'
import { format, isToday } from 'date-fns'
import {
  AlertTriangle,
  Camera,
  Dog as DogIcon,
  Loader2,
  Pencil,
  Plus,
  Search,
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
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  // Bumped after log/delete so the calendar's day markers refresh
  const [mealsVersion, setMealsVersion] = useState(0)
  const [isLoadingDay, setIsLoadingDay] = useState(false)
  const [deletingMealId, setDeletingMealId] = useState<string | null>(null)
  const [editingMeal, setEditingMeal] = useState<DogMealForEdit | null>(null)
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null)

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
    // Send the local calendar date; the server's default "today" is UTC-based
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    try {
      const [gaps, dogMeals] = await Promise.all([
        getDogDailyGaps(selectedDogId, dateStr),
        getDogMeals(selectedDogId, dateStr),
      ])
      setDailyGaps(gaps)
      setMeals(dogMeals)
    } catch (error) {
      console.error('Error loading daily gaps:', error)
      toast.error("Failed to load the day's nutrition")
    } finally {
      setIsLoadingDay(false)
    }
  }, [selectedDogId, selectedDate])

  useEffect(() => {
    loadDay()
    setEditingMeal(null)
  }, [loadDay])

  const handleDeleteMeal = async (mealId: string) => {
    setDeletingMealId(mealId)
    try {
      await deleteDogMeal(mealId)
      toast.success('Meal removed')
      if (editingMeal?.id === mealId) setEditingMeal(null)
      setMealsVersion(v => v + 1)
      await loadDay()
    } catch (error) {
      console.error('Delete meal error:', error)
      toast.error('Failed to delete meal')
    } finally {
      setDeletingMealId(null)
    }
  }

  const handleEditMeal = async (mealId: string) => {
    setLoadingEditId(mealId)
    try {
      const meal = await getDogMealForEdit(mealId)
      setEditingMeal(meal)
    } catch (error) {
      console.error('Load meal for edit error:', error)
      toast.error('Failed to load meal for editing')
    } finally {
      setLoadingEditId(null)
    }
  }

  const handleMealSaved = async (_result: DogMealResult) => {
    setEditingMeal(null)
    setMealsVersion(v => v + 1)
    await loadDay()
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

        {/* The two things a guest can actually do. Without these the guest
            dashboard is a dead end — /bowl and the nutrient tab on /foods are
            both reachable, but nothing pointed at them. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Camera className="h-5 w-5" />
                Scan a bowl
              </CardTitle>
              <CardDescription>
                Photograph a bowl and see what&apos;s in it, with safety
                warnings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/bowl">Try a bowl scan</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Search className="h-5 w-5" />
                Search by nutrient
              </CardTitle>
              <CardDescription>
                Find ingredients high in lysine, taurine, calcium, and more.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/foods">Browse ingredients</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

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
  const viewingToday = isToday(selectedDate)
  const dayLabel = viewingToday
    ? 'today'
    : `on ${format(selectedDate, 'MMMM d')}`

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
            onValueChange={id => {
              setSelectedDogId(id)
              setEditingMeal(null)
            }}
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
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href={`/bowl?dog=${selectedDogId ?? ''}`}>
              <Camera className="mr-2 h-4 w-4" />
              Log from photo
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/foods">
              <Search className="mr-2 h-4 w-4" />
              Browse foods
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dogs">Manage dogs</Link>
          </Button>
        </div>
      </div>

      {dailyGaps && dailyGaps.unsafeIngredients.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unsafe ingredients logged {dayLabel}</AlertTitle>
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
                  {selectedDog.name}&apos;s{' '}
                  {viewingToday ? 'day' : format(selectedDate, 'MMMM d')}
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
            <DogMealBuilder
              dogId={selectedDogId}
              onMealLogged={handleMealSaved}
              editingMeal={editingMeal ?? undefined}
              onCancelEdit={() => setEditingMeal(null)}
              date={format(selectedDate, 'yyyy-MM-dd')}
            />
          )}

          {selectedDogId && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  {viewingToday
                    ? "Today's meals"
                    : `Meals on ${format(selectedDate, 'MMMM d, yyyy')}`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {meals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {isLoadingDay
                      ? 'Loading…'
                      : `No meals logged ${dayLabel}.`}
                  </p>
                ) : (
                <ul className="space-y-2">
                  {meals.map(meal => (
                    <li
                      key={meal.id}
                      className={`flex items-start justify-between gap-2 rounded-md border p-3 ${
                        editingMeal?.id === meal.id ? 'border-primary' : ''
                      }`}
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
                      <div className="flex items-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditMeal(meal.id)}
                          disabled={loadingEditId === meal.id}
                          aria-label="Edit meal"
                        >
                          {loadingEditId === meal.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Pencil className="h-4 w-4" />
                          )}
                        </Button>
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
                      </div>
                    </li>
                  ))}
                </ul>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {selectedDogId && (
            <MealCalendar
              dogId={selectedDogId}
              selected={selectedDate}
              onSelect={date => {
                setSelectedDate(date)
                setEditingMeal(null)
              }}
              refreshKey={mealsVersion}
            />
          )}

          <Card className="h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Nutrient coverage</CardTitle>
              <CardDescription>
                {viewingToday
                  ? "Today's"
                  : `${format(selectedDate, 'MMMM d')}'s`}{' '}
                intake vs. AAFCO daily targets
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
    </div>
  )
}
