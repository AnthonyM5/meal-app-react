'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  createDogMeal,
  updateDogMeal,
  type DogMealForEdit,
  type DogMealResult,
} from '@/lib/meal-actions'
import type { Food, MealType } from '@/lib/types'
import { AlertTriangle, Loader2, Plus, Search, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

interface BuilderItem {
  food: Food
  grams: number
}

interface DogMealBuilderProps {
  dogId: string
  onMealLogged?: (result: DogMealResult) => void
  /** When set, the builder edits this existing meal instead of creating one */
  editingMeal?: DogMealForEdit
  onCancelEdit?: () => void
}

export function DogMealBuilder({
  dogId,
  onMealLogged,
  editingMeal,
  onCancelEdit,
}: DogMealBuilderProps) {
  const isEditing = !!editingMeal
  const [mealType, setMealType] = useState<MealType>(
    editingMeal?.mealType ?? 'breakfast'
  )
  const [items, setItems] = useState<BuilderItem[]>(
    () => editingMeal?.items.map(item => ({ food: item.food, grams: item.grams })) ?? []
  )
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Food[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [isLogging, setIsLogging] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Re-sync when switching which meal is being edited (or back to create)
  useEffect(() => {
    setMealType(editingMeal?.mealType ?? 'breakfast')
    setItems(
      editingMeal?.items.map(item => ({ food: item.food, grams: item.grams })) ?? []
    )
  }, [editingMeal])

  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (query.length >= 2) {
        setIsSearching(true)
        try {
          const response = await fetch(
            `/api/foods/unified-search?q=${encodeURIComponent(query)}`
          )
          const data = await response.json()
          setResults(data.foods || [])
        } catch (error) {
          console.error('Search error:', error)
          toast.error('Failed to search ingredients')
        } finally {
          setIsSearching(false)
        }
      } else {
        setResults([])
      }
    }, 300)

    return () => clearTimeout(searchTimeout)
  }, [query])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const addItem = (food: Food) => {
    if (items.some(item => item.food.id === food.id)) {
      toast.info(`${food.name} is already in this meal`)
      return
    }
    if (food.is_safe_for_dogs === false) {
      toast.warning(`${food.name} is flagged as unsafe for dogs`, {
        description: food.toxicity_note ?? undefined,
      })
    }
    setItems(prev => [...prev, { food, grams: 100 }])
    setQuery('')
    setResults([])
    setIsFocused(false)
  }

  const updateGrams = (foodId: string, grams: number) => {
    setItems(prev =>
      prev.map(item => (item.food.id === foodId ? { ...item, grams } : item))
    )
  }

  const removeItem = (foodId: string) => {
    setItems(prev => prev.filter(item => item.food.id !== foodId))
  }

  const handleLogMeal = async () => {
    if (items.length === 0) {
      toast.error('Add at least one ingredient')
      return
    }
    if (items.some(item => !item.grams || item.grams <= 0)) {
      toast.error('Every ingredient needs a gram amount greater than 0')
      return
    }

    const itemInputs = items.map(item => ({
      ingredient_id: item.food.id,
      grams: item.grams,
    }))

    setIsLogging(true)
    try {
      const result = isEditing
        ? await updateDogMeal(editingMeal!.id, mealType, itemInputs)
        : await createDogMeal(dogId, mealType, itemInputs)

      toast.success(
        `${isEditing ? 'Updated' : 'Logged'} ${mealType} — ${Math.round(
          result.mealKcal
        )} kcal`
      )
      if (!isEditing) setItems([])
      onMealLogged?.(result)
    } catch (error) {
      console.error('Save meal error:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to save meal'
      )
    } finally {
      setIsLogging(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {isEditing ? 'Edit meal' : 'Log a meal'}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select
              value={mealType}
              onValueChange={v => setMealType(v as MealType)}
            >
              <SelectTrigger className="w-32 capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEAL_TYPES.map(type => (
                  <SelectItem key={type} value={type} className="capitalize">
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isEditing && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onCancelEdit}
                aria-label="Cancel editing"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div ref={searchContainerRef} className="relative">
          <div className="relative">
            <Input
              type="text"
              placeholder="Search ingredients (e.g. chicken breast)..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              className="pr-10"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              {isSearching ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <Search className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </div>

          {isFocused && query.length > 1 && (
            <div className="absolute z-10 mt-1 w-full">
              <Card className="shadow-lg">
                <CardContent className="max-h-64 overflow-y-auto p-2">
                  {isSearching && results.length === 0 ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : results.length > 0 ? (
                    <ul>
                      {results.map(food => (
                        <li key={food.id}>
                          <button
                            type="button"
                            onClick={() => addItem(food)}
                            className="flex w-full items-center justify-between rounded-md p-2 text-left hover:bg-muted"
                          >
                            <span>
                              <span className="flex items-center gap-1.5 font-medium">
                                {food.name}
                                {food.preparation_state && (
                                  <Badge
                                    variant="outline"
                                    className="px-1.5 py-0 text-xs font-normal text-muted-foreground"
                                  >
                                    {food.preparation_state}
                                  </Badge>
                                )}
                                {food.is_safe_for_dogs === false && (
                                  <AlertTriangle className="h-4 w-4 text-red-500" />
                                )}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {food.calories_per_serving} kcal per{' '}
                                {food.serving_size} g
                              </span>
                            </span>
                            <Plus className="h-4 w-4 shrink-0" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    !isSearching && (
                      <p className="p-4 text-center text-sm text-muted-foreground">
                        No results found for &quot;{query}&quot;.
                      </p>
                    )
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {items.length > 0 && (
          <ul className="space-y-2">
            {items.map(item => (
              <li
                key={item.food.id}
                className="flex items-center justify-between gap-2 rounded-md border p-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {item.food.name}
                    {item.food.preparation_state && (
                      <Badge
                        variant="outline"
                        className="shrink-0 px-1.5 py-0 text-xs font-normal text-muted-foreground"
                      >
                        {item.food.preparation_state}
                      </Badge>
                    )}
                  </p>
                  {item.food.is_safe_for_dogs === false && (
                    <p className="text-xs text-red-500">
                      Unsafe for dogs
                      {item.food.toxicity_note
                        ? ` — ${item.food.toxicity_note}`
                        : ''}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={item.grams || ''}
                    onChange={e =>
                      updateGrams(item.food.id, Number(e.target.value))
                    }
                    className="w-20 text-right"
                    aria-label={`Grams of ${item.food.name}`}
                  />
                  <span className="text-sm text-muted-foreground">g</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(item.food.id)}
                    aria-label={`Remove ${item.food.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Button
          onClick={handleLogMeal}
          disabled={isLogging || items.length === 0}
          className="w-full"
        >
          {isLogging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? 'Save changes' : `Log ${mealType}`}
        </Button>
      </CardContent>
    </Card>
  )
}
