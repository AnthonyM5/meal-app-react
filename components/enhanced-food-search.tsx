"use client"

import { useState, useEffect } from "react"
import { Search, Plus, Loader2, Database, Globe } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { enhancedFoodSearch, addUSDAFoodToMeal } from "@/lib/enhanced-food-actions"
import { addFoodToMeal } from "@/lib/food-actions"
import type { Food, MealType } from "@/lib/types"
import { toast } from "sonner"

interface EnhancedFoodSearchProps {
  mealType: MealType
  onFoodAdded?: () => void
}

export function EnhancedFoodSearch({ mealType, onFoodAdded }: EnhancedFoodSearchProps) {
  const [query, setQuery] = useState("")
  const [localFoods, setLocalFoods] = useState<Food[]>([])
  const [usdaFoods, setUsdaFoods] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [addingFoodId, setAddingFoodId] = useState<string | null>(null)

  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (query.length >= 2) {
        setIsSearching(true)
        try {
          const results = await enhancedFoodSearch(query)
          setLocalFoods(results.localFoods)
          setUsdaFoods(results.usdaFoods)
        } catch (error) {
          console.error("Search error:", error)
          toast.error("Failed to search foods")
        } finally {
          setIsSearching(false)
        }
      } else {
        setLocalFoods([])
        setUsdaFoods([])
      }
    }, 500) // Slightly longer delay for USDA API

    return () => clearTimeout(searchTimeout)
  }, [query])

  const handleAddLocalFood = async (food: Food) => {
    setAddingFoodId(food.id)
    try {
      await addFoodToMeal(food.id, mealType)
      toast.success(`Added ${food.name} to ${mealType}`)
      onFoodAdded?.()
      setQuery("")
      setLocalFoods([])
      setUsdaFoods([])
    } catch (error) {
      console.error("Add food error:", error)
      toast.error("Failed to add food")
    } finally {
      setAddingFoodId(null)
    }
  }

  const handleAddUSDAFood = async (usdaFood: any) => {
    setAddingFoodId(`usda-${usdaFood.fdcId}`)
    try {
      await addUSDAFoodToMeal(usdaFood.fdcId, mealType)
      toast.success(`Added ${usdaFood.description} to ${mealType}`)
      onFoodAdded?.()
      setQuery("")
      setLocalFoods([])
      setUsdaFoods([])
    } catch (error) {
      console.error("Add USDA food error:", error)
      toast.error("Failed to add food from USDA database")
    } finally {
      setAddingFoodId(null)
    }
  }

  const totalResults = localFoods.length + usdaFoods.length

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search foods from local database and USDA..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin" />
        )}
      </div>

      {totalResults > 0 && (
        <Tabs defaultValue="local" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="local" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Local ({localFoods.length})
            </TabsTrigger>
            <TabsTrigger value="usda" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              USDA ({usdaFoods.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="local" className="space-y-2 max-h-96 overflow-y-auto">
            {localFoods.map((food) => (
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
                      onClick={() => handleAddLocalFood(food)}
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
            {localFoods.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">No local foods found</div>
            )}
          </TabsContent>

          <TabsContent value="usda" className="space-y-2 max-h-96 overflow-y-auto">
            {usdaFoods.map((food) => (
              <Card key={food.fdcId} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{food.description}</h3>
                        {(food.brandOwner || food.brandName) && (
                          <Badge variant="outline" className="text-xs">
                            {food.brandOwner || food.brandName}
                          </Badge>
                        )}
                        <Badge variant="default" className="text-xs">
                          USDA
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {Math.round(food.calories)} cal per {food.servingSize || 100}
                        {food.servingSizeUnit || "g"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        P: {Math.round(food.protein)}g • C: {Math.round(food.carbs)}g • F: {Math.round(food.fat)}g
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAddUSDAFood(food)}
                      disabled={addingFoodId === `usda-${food.fdcId}`}
                      className="ml-4"
                    >
                      {addingFoodId === `usda-${food.fdcId}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {usdaFoods.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">No USDA foods found</div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {query.length >= 2 && totalResults === 0 && !isSearching && (
        <div className="text-center py-8 text-muted-foreground">No foods found for "{query}"</div>
      )}
    </div>
  )
}
