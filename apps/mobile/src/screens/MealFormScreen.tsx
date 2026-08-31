import type { DogMealResult } from '@pawplate/api-client'
import {
  computeMealNutrients,
  findUnsafeIngredients,
  type CanonicalSearchResult,
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

/**
 * Debounced GROUPED ingredient search over the Bearer-auth REST route. Returns
 * one row per canonical food (e.g. "Beef, chuck") instead of the ~960
 * near-duplicate USDA variants a flat search returns for "beef" — the picker
 * experience the bowl screen already uses. Ambiguous groups are expanded to
 * their variants lazily on tap (see `loadVariants` in the component).
 */
function useGroupedIngredientSearch(query: string) {
  const [groups, setGroups] = useState<CanonicalSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    if (query.length < 2) {
      setGroups([])
      setIsSearching(false)
      return
    }
    let cancelled = false
    const timeout = setTimeout(async () => {
      setIsSearching(true)
      try {
        const found = await api.ingredients.groupedSearch(query)
        if (!cancelled) setGroups(found)
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

  return { groups, isSearching }
}

/** kcal per 100 g from a normalized serving — servings are NOT always 100 g. */
function kcalPer100g(calories: number, servingSize: number): number {
  if (!servingSize) return 0
  return Math.round((calories / servingSize) * 100)
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
  const { groups, isSearching } = useGroupedIngredientSearch(query)
  // Variant expansion for ambiguous groups (variant_count > 1). Variants are
  // fetched once per canonical group and cached for the life of the search.
  const [expandedCanonicalId, setExpandedCanonicalId] = useState<string | null>(
    null
  )
  const [variantsByCanonical, setVariantsByCanonical] = useState<
    Record<string, Ingredient[]>
  >({})
  const [loadingCanonicalId, setLoadingCanonicalId] = useState<string | null>(
    null
  )

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
    setExpandedCanonicalId(null)
    setItems(current => {
      if (current.some(item => item.ingredient.id === ingredient.id)) {
        toast.info(`${ingredient.name} is already in this meal`)
        return current
      }
      return [...current, { ingredient, grams: '100' }]
    })
  }

  /** Fetch (and cache) the full variant rows for a canonical group. Full rows
   *  carry the micronutrients and toxicity flags the grouped result omits, so
   *  the kcal preview and unsafe-ingredient warning stay accurate. */
  async function loadVariants(canonicalId: string): Promise<Ingredient[]> {
    const cached = variantsByCanonical[canonicalId]
    if (cached) return cached
    setLoadingCanonicalId(canonicalId)
    try {
      const variants = await api.ingredients.variants(canonicalId)
      setVariantsByCanonical(current => ({
        ...current,
        [canonicalId]: variants,
      }))
      return variants
    } finally {
      // Only clear if THIS request is still the one showing a spinner — a
      // later tap on another group may have moved the loading id on, and an
      // unconditional clear would hide that request's spinner mid-flight.
      setLoadingCanonicalId(current =>
        current === canonicalId ? null : current
      )
    }
  }

  /** Tap a group: add it outright when it has a single variant, otherwise
   *  toggle its variant list open so the owner picks the exact one. */
  async function selectGroup(group: CanonicalSearchResult) {
    if (expandedCanonicalId === group.canonical_id) {
      setExpandedCanonicalId(null)
      return
    }
    try {
      const variants = await loadVariants(group.canonical_id)
      if (variants.length <= 1) {
        const only = variants[0]
        if (only) addIngredient(only)
        else toast.error('No options available for this ingredient')
      } else {
        setExpandedCanonicalId(group.canonical_id)
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not load options'
      )
    }
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
          {query.length >= 2 && (isSearching || groups.length > 0) && (
            <div className="absolute z-10 max-h-72 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
              {groups.length === 0 && !isSearching ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  No matches
                </p>
              ) : (
                groups.map(group => {
                  const isExpanded = expandedCanonicalId === group.canonical_id
                  const isLoading = loadingCanonicalId === group.canonical_id
                  const variants = variantsByCanonical[group.canonical_id] ?? []
                  return (
                    <div
                      key={group.canonical_id}
                      className="border-b last:border-b-0"
                    >
                      <button
                        type="button"
                        className="flex w-full items-baseline justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                        onClick={() => selectGroup(group)}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {group.display_name}
                        </span>
                        <span className="ml-2 flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            {kcalPer100g(
                              group.calories_per_serving,
                              group.serving_size
                            )}{' '}
                            kcal/100g
                          </span>
                          {group.variant_count > 1 && (
                            <span className="rounded bg-muted px-1.5 py-0.5">
                              {group.variant_count} options
                            </span>
                          )}
                          {isLoading && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          )}
                        </span>
                      </button>
                      {isExpanded && variants.length > 0 && (
                        <ul className="divide-y border-t bg-background">
                          {variants.map(variant => (
                            <li key={variant.id}>
                              <button
                                type="button"
                                className="flex w-full items-baseline justify-between py-2 pl-6 pr-3 text-left text-sm hover:bg-accent"
                                onClick={() => addIngredient(variant)}
                              >
                                <span className="min-w-0 flex-1 truncate">
                                  {variant.name}
                                </span>
                                <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                                  {kcalPer100g(
                                    variant.calories_per_serving,
                                    variant.serving_size
                                  )}{' '}
                                  kcal/100g
                                  {variant.preparation_state
                                    ? ` · ${variant.preparation_state}`
                                    : ''}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })
              )}
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
