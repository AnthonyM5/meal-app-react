"use client"

import { useState, useEffect } from "react"
import { Search, Plus, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { searchFoods, addFoodToMeal } from "@/lib/food-actions"
import type { Food, MealType } from "@/lib/types"
import { toast } from "sonner"

interface FoodSearchProps {
  mealType: MealType
  onFoodAdded?: () => void
}

export function FoodSearch({ mealType, onFoodAdded }: FoodSearchProps) {
  const [query, setQuery] = useState("")
  const [foods, setFoods] = useState<Food[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [addingFoodId, setAddingFoodId] = useState<string | null>(null)

  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (query.length >= 2) {
        setIsSearching(true)
        try {
          const results = await searchFoods(query)
          setFoods(results)
        } catch (error) {
          console.error("Search error:", error)
          toast.error("Failed to search foods")
        } finally {
          setIsSearching(false)
        }
      } else {
        setFoods([])
      }
    }, 300)

    return () => clearTimeout(searchTimeout)
  }, [query])

  const handleAddFood = async (food: Food) => {
    setAddingFoodId(food.id)
    try {
      await addFoodToMeal(food.id, mealType)
      toast.success(`Added ${food.name} to ${mealType}`)
      onFoodAdded?.()
      setQuery("")
      setFoods([])
    } catch (error) {
      console.error("Add food error:", error)
      toast.error("Failed to add food")
    } finally {
      setAddingFoodId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search for foods..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin" />
        )}
      </div>

      {foods.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {foods.map((food) => (
            <Card key={food.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{food.name}</h3>
                      {food.brand && (
                        <Badge variant="outline" className="text-xs">
                          {food.brand}
                        </Badge>
                      )}
                      {food.is_verified && (
                        <Badge variant="secondary" className="text-xs">
                          Verified
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {food.calories_per_serving} cal per {food.serving_size}
                      {food.serving_unit}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      P: {food.protein_g}g • C: {food.carbs_g}g • F: {food.fat_g}g
                      {food.fiber_g > 0 && ` • Fiber: ${food.fiber_g}g`}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleAddFood(food)}
                    disabled={addingFoodId === food.id}
                    className="ml-4"
                  >
                    {addingFoodId === food.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {query.length >= 2 && foods.length === 0 && !isSearching && (
        <div className="text-center py-8 text-muted-foreground">No foods found for "{query}"</div>
      )}
    </div>
  )
}
