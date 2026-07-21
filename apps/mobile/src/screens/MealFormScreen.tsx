import type { DogMealResult } from '@pawplate/api-client'
import {
  computeMealNutrients,
  findUnsafeIngredients,
  type Ingredient,
  type MealType,
} from '@pawplate/core'
import { Button } from '@pawplate/ui/button'
import { Card, CardContent } from '@pawplate/ui/card'
import { Input } from '@pawplate/ui/input'
import { Label } from '@pawplate/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pawplate/ui/select'
import { AlertTriangle, ArrowLeft, Loader2, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { api } from '../lib/api'

const MEAL_TYPES: Array<{ value: MealType; label: string }> = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
]

interface MealItemDraft {
  ingredient: Ingredient
  grams: string
}

/** Debounced ingredient search over the Bearer-auth REST route. */
function useIngredientSearch(query: string) {
  const [results, setResults] = useState<Ingredient[]>([])
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setIsSearching(false)
      return
    }
    let cancelled = false
    const timeout = setTimeout(async () => {
      setIsSearching(true)
      try {
        const foods = await api.ingredients.search(query)
        if (!cancelled) setResults(foods)
      } catch {
        if (!cancelled) toast.error('Ingredient search failed')
      } finally {
        if (!cancelled) setIsSearching(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [query])

  return { results, isSearching }
}

export function MealFormScreen() {
  const params = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const mealId = params.mealId
  const isEdit = Boolean(mealId)

  const [dogId, setDogId] = useState(params.dogId ?? '')
  const [date] = useState(searchParams.get('date') ?? undefined)
  const [mealType, setMealType] = useState<MealType>('breakfast')
  const [mealName, setMealName] = useState('')
  const [items, setItems] = useState<MealItemDraft[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)
  const { results, isSearching } = useIngredientSearch(query)

  useEffect(() => {
    if (!mealId) return
    let cancelled = false
    api.meals
      .get(mealId)
      .then(meal => {
        if (cancelled) return
        setDogId(meal.dogId)
        setMealType(meal.mealType)
        setMealName(meal.name ?? '')
        setItems(
          meal.items.map(item => ({
            ingredient: item.food,
            grams: String(item.grams),
          }))
        )
        setLoading(false)
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
  }, [mealId, navigate])

  const numericItems = useMemo(
    () =>
      items.map(item => ({
        ingredient: item.ingredient,
        grams: Number(item.grams) || 0,
      })),
    [items]
  )
  const previewKcal = useMemo(
    () => computeMealNutrients(numericItems).totals.calories,
    [numericItems]
  )
  const unsafe = useMemo(
    () => findUnsafeIngredients(numericItems),
    [numericItems]
  )

  function addIngredient(ingredient: Ingredient) {
    setQuery('')
    setItems(current => {
      if (current.some(item => item.ingredient.id === ingredient.id)) {
        toast.info(`${ingredient.name} is already in this meal`)
        return current
      }
      return [...current, { ingredient, grams: '100' }]
    })
  }

  function setGrams(ingredientId: string, grams: string) {
    setItems(current =>
      current.map(item =>
        item.ingredient.id === ingredientId ? { ...item, grams } : item
      )
    )
  }

  function removeItem(ingredientId: string) {
    setItems(current =>
      current.filter(item => item.ingredient.id !== ingredientId)
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const payloadItems = items
      .map(item => ({
        ingredient_id: item.ingredient.id,
        grams: Number(item.grams),
      }))
      .filter(item => item.grams > 0)

    if (payloadItems.length === 0) {
      toast.error('Add at least one ingredient with a weight')
      return
    }

    setSubmitting(true)
    try {
      let result: DogMealResult
      if (mealId) {
        result = await api.meals.update(mealId, {
          meal_type: mealType,
          items: payloadItems,
          name: mealName.trim() || undefined,
        })
      } else {
        result = await api.meals.createForDog(dogId, {
          meal_type: mealType,
          items: payloadItems,
          name: mealName.trim() || undefined,
          date,
        })
      }

      if (result.unsafeIngredients.length > 0) {
        toast.warning(
          `Unsafe for dogs: ${result.unsafeIngredients
            .map(item => item.name)
            .join(', ')}${result.requiresVetNotice ? ' — contact your vet.' : ''}`
        )
      }
      toast.success(
        `Meal ${isEdit ? 'updated' : 'logged'} — ${Math.round(result.mealKcal)} kcal`
      )
      navigate(`/dogs/${dogId}${date ? `?date=${date}` : ''}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const backTo = `/dogs/${dogId}${date ? `?date=${date}` : ''}`

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild aria-label="Back">
          <Link to={backTo}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">
          {isEdit ? 'Edit meal' : 'Log a meal'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Meal</Label>
            <Select
              value={mealType}
              onValueChange={value => setMealType(value as MealType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEAL_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="meal-name">Name (optional)</Label>
            <Input
              id="meal-name"
              value={mealName}
              onChange={e => setMealName(e.target.value)}
            />
          </div>
        </div>

        <div className="relative space-y-2">
          <Label htmlFor="ingredient-search">Add ingredients</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="ingredient-search"
              className="pl-9"
              placeholder="Search ingredients…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          {results.length > 0 && (
            <div className="absolute z-10 max-h-64 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
              {results.map(food => (
                <button
                  key={food.id}
                  type="button"
                  className="flex w-full items-baseline justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => addIngredient(food)}
                >
                  <span>{food.name}</span>
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                    {Math.round(food.calories_per_serving)} kcal /{' '}
                    {food.serving_size} {food.serving_unit}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {unsafe.length > 0 && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Unsafe for dogs:{' '}
              {unsafe
                .map(item =>
                  item.toxicity_note
                    ? `${item.name} (${item.toxicity_note})`
                    : item.name
                )
                .join(', ')}
            </p>
          </div>
        )}

        {items.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Search above to add ingredients to this meal.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {items.map(item => (
              <Card key={item.ingredient.id}>
                <CardContent className="flex items-center gap-2 py-3">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">
                    {item.ingredient.name}
                  </p>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="1"
                    className="w-20 text-right"
                    aria-label={`Grams of ${item.ingredient.name}`}
                    value={item.grams}
                    onChange={e =>
                      setGrams(item.ingredient.id, e.target.value)
                    }
                  />
                  <span className="text-sm text-muted-foreground">g</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${item.ingredient.name}`}
                    onClick={() => removeItem(item.ingredient.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
            <p className="text-right text-sm text-muted-foreground">
              ~{Math.round(previewKcal)} kcal
            </p>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? 'Save changes' : 'Log meal'}
        </Button>
      </form>
    </div>
  )
}
