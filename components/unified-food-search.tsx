'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { addFoodToMeal } from '@/lib/food-actions'
import type { Food, MealType } from '@/lib/types'
import { Loader2, Plus, Search } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

interface UnifiedFoodSearchProps {
  mealType: MealType
  onFoodAdded?: () => void
}

export function UnifiedFoodSearch({
  mealType,
  onFoodAdded,
}: UnifiedFoodSearchProps) {
  const [query, setQuery] = useState('')
  const [foods, setFoods] = useState<Food[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [addingFoodId, setAddingFoodId] = useState<string | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Unified search that includes auto-import from external APIs
  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (query.length >= 2) {
        setIsSearching(true)
        try {
          const response = await fetch(
            `/api/foods/unified-search?q=${encodeURIComponent(query)}`
          )
          const data = await response.json()
          setFoods(data.foods || [])
        } catch (error) {
          console.error('Search error:', error)
          toast.error('Failed to search foods')
        } finally {
          setIsSearching(false)
        }
      } else {
        setFoods([])
      }
    }, 300) // Faster response since we're searching local DB first

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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleAddFood = async (food: Food) => {
    setAddingFoodId(food.id)
    try {
      await addFoodToMeal(food.id, mealType)
      toast.success(`Added ${food.name} to ${mealType}`)
      onFoodAdded?.()
      setQuery('')
      setFoods([])
    } catch (error) {
      console.error('Add food error:', error)
      toast.error('Failed to add food')
    } finally {
      setAddingFoodId(null)
    }
  }

  return (
    <div ref={searchContainerRef} className="relative">
      <div className="relative">
        <Input
          type="text"
          placeholder="Search for a food..."
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
            <CardContent className="p-2">
              {isSearching && foods.length === 0 ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : foods.length > 0 ? (
                <ul>
                  {foods.map(food => (
                    <li
                      key={food.id}
                      className="flex items-center justify-between rounded-md p-2 hover:bg-muted"
                    >
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/food-details/${food.id}`}
                          className="group"
                          onClick={() => setIsFocused(false)}
                        >
                          <span className="font-semibold group-hover:underline">
                            {food.name}
                          </span>
                          <p className="text-sm text-muted-foreground">
                            {food.calories_per_serving} kcal per{' '}
                            {food.serving_size}
                          </p>
                        </Link>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAddFood(food)}
                          disabled={addingFoodId === food.id}
                        >
                          {addingFoodId === food.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="mr-2 h-4 w-4" />
                          )}
                          Add
                        </Button>
                      </div>
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
  )
}
