import type { DogDailyGaps, DogMealSummary } from '@pawplate/api-client'
import type { Dog, MealType } from '@pawplate/core'
import { Button } from '@pawplate/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@pawplate/ui/card'
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { GapBars } from '../components/GapBars'
import { api } from '../lib/api'

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function shiftDate(dateString: string, days: number): string {
  const [y, m, d] = dateString.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return toDateString(date)
}

function formatDisplayDate(dateString: string): string {
  const [y, m, d] = dateString.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function DogDetailScreen() {
  const { dogId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const today = toDateString(new Date())
  const [date, setDate] = useState(searchParams.get('date') ?? today)
  const [dog, setDog] = useState<Dog | null>(null)
  const [meals, setMeals] = useState<DogMealSummary[] | null>(null)
  const [gaps, setGaps] = useState<DogDailyGaps | null>(null)

  useEffect(() => {
    if (!dogId) return
    let cancelled = false
    api.dogs
      .get(dogId)
      .then(result => {
        if (!cancelled) setDog(result)
      })
      .catch((error: Error) => {
        if (!cancelled) {
          toast.error(error.message)
          navigate('/dogs', { replace: true })
        }
      })
    return () => {
      cancelled = true
    }
  }, [dogId, navigate])

  const loadDay = useCallback(async () => {
    if (!dogId) return
    try {
      const [mealsResult, gapsResult] = await Promise.all([
        api.meals.listForDog(dogId, date),
        api.meals.gaps(dogId, date),
      ])
      setMeals(mealsResult)
      setGaps(gapsResult)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Load failed')
      setMeals([])
      setGaps(null)
    }
  }, [dogId, date])

  useEffect(() => {
    setMeals(null)
    setGaps(null)
    void loadDay()
  }, [loadDay])

  async function handleDeleteMeal(meal: DogMealSummary) {
    if (!window.confirm(`Delete this ${MEAL_TYPE_LABELS[meal.meal_type].toLowerCase()}?`)) {
      return
    }
    try {
      await api.meals.remove(meal.id)
      toast.success('Meal deleted')
      void loadDay()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Delete failed')
    }
  }

  if (!dog) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const loadingDay = meals === null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild aria-label="Back">
          <Link to="/dogs">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="flex-1 text-2xl font-semibold">{dog.name}</h1>
        <Button variant="ghost" size="icon" asChild aria-label="Edit dog">
          <Link to={`/dogs/${dog.id}/edit`}>
            <Pencil className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous day"
          onClick={() => setDate(shiftDate(date, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <button
          className="text-sm font-medium"
          onClick={() => setDate(today)}
          title="Jump to today"
        >
          {date === today ? 'Today' : formatDisplayDate(date)}
        </button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next day"
          disabled={date >= today}
          onClick={() => setDate(shiftDate(date, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {loadingDay ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {gaps && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {Math.round(gaps.totalKcal)} / {Math.round(gaps.dailyKcal)}{' '}
                  kcal today
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {gaps.unsafeIngredients.length > 0 && (
                  <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-medium">
                        Unsafe ingredients logged today:
                      </p>
                      <ul className="list-inside list-disc">
                        {gaps.unsafeIngredients.map(item => (
                          <li key={item.id}>
                            {item.name}
                            {item.toxicity_note ? ` — ${item.toxicity_note}` : ''}
                          </li>
                        ))}
                      </ul>
                      {gaps.requiresVetNotice && (
                        <p className="mt-1 font-medium">
                          Contact your vet if your dog ate these.
                        </p>
                      )}
                    </div>
                  </div>
                )}
                <GapBars gaps={gaps.gaps} />
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Meals</h2>
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to={`/dogs/${dog.id}/bowl`}>
                  <Camera className="mr-1 h-4 w-4" /> Photo
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link to={`/dogs/${dog.id}/meals/new?date=${date}`}>
                  <Plus className="mr-1 h-4 w-4" /> Add meal
                </Link>
              </Button>
            </div>
          </div>

          {meals.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No meals logged for this day.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {meals.map(meal => (
                <Card key={meal.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {MEAL_TYPE_LABELS[meal.meal_type]}
                        {meal.name ? ` · ${meal.name}` : ''}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {Math.round(meal.calories)} kcal
                        {meal.items.length > 0 &&
                          ` · ${meal.items
                            .map(item => `${item.name} (${item.grams} g)`)
                            .join(', ')}`}
                      </p>
                    </div>
                    <div className="ml-2 flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        aria-label="Edit meal"
                      >
                        <Link to={`/meals/${meal.id}/edit`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete meal"
                        onClick={() => handleDeleteMeal(meal)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
