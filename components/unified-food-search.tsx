"use client"

import { useState, useEffect } from "react"
import { Search, Plus, Loader2, Download } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { addFoodToMeal } from "@/lib/food-actions"
import type { Food, MealType } from "@/lib/types"
import { toast } from "sonner"

interface UnifiedFoodSearchProps {
  mealType: MealType
  onFoodAdded?: () => void
}

export function UnifiedFoodSearch({ mealType, onFoodAdded }: UnifiedFoodSearchProps) {
  const [query, setQuery] = useState("")
  const [foods, setFoods] = useState<Food[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [addingFoodId, setAddingFoodId] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  // Unified search that includes auto-import from external APIs
  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (query.length >= 2) {
        setIsSearching(true)
        try {
          const response = await fetch(`/api/foods/unified-search?q=${encodeURIComponent(query)}`)
          const data = await response.json()
          setFoods(data.foods || [])
        } catch (error) {
          console.error("Search error:", error)
          toast.error("Failed to search foods")
        } finally {
          setIsSearching(false)
        }
      } else {
        setFoods([])
      }
    }, 300) // Faster response since we're searching local DB first

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

  const handleImportMoreFoods = async () => {
    if (!query || query.length < 2) return

    setIsImporting(true)
    try {
      const response = await fetch("/api/foods/import-external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      })

      const data = await response.json()
      if (data.imported > 0) {
        toast.success(`Imported ${data.imported} new foods! Search again to see them.`)
        // Refresh search results
        const searchResponse = await fetch(`/api/foods/unified-search?q=${encodeURIComponent(query)}`)
        const searchData = await searchResponse.json()
        setFoods(searchData.foods || [])
      } else {
        toast.info("No new foods found to import")
      }
    } catch (error) {
      console.error("Import error:", error)
      toast.error("Failed to import foods")
    } finally {
      setIsImporting(false)
    }
  }

  const getSourceBadge = (food: Food) => {
    if (food.brand === "USDA") return { label: "USDA", variant: "default" as const }
    if (food.is_verified) return { label: "Verified", variant: "secondary" as const }
    return null
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search foods from all sources..."
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
          {foods.map((food) => {
            const sourceBadge = getSourceBadge(food)
            return (
              <Card key={food.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{food.name}</h3>
                        {food.brand && food.brand !== "USDA" && (
                          <Badge variant="outline" className="text-xs">
                            {food.brand}
                          </Badge>
                        )}
                        {sourceBadge && (
                          <Badge variant={sourceBadge.variant} className="text-xs">
                            {sourceBadge.label}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {Math.round(food.calories_per_serving)} cal per {food.serving_size}
                        {food.serving_unit}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        P: {Math.round(food.protein_g)}g • C: {Math.round(food.carbs_g)}g • F: {Math.round(food.fat_g)}g
                        {food.fiber_g > 0 && ` • Fiber: ${Math.round(food.fiber_g)}g`}
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
            )
          })}
        </div>
      )}

      {query.length >= 2 && foods.length === 0 && !isSearching && (
        <div className="text-center py-8 space-y-4">
          <div className="text-muted-foreground">No foods found for "{query}"</div>
          <Button
            variant="outline"
            onClick={handleImportMoreFoods}
            disabled={isImporting}
            className="flex items-center gap-2"
          >
            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Import from external databases
          </Button>
        </div>
      )}

      {query.length >= 2 && foods.length > 0 && (
        <div className="text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleImportMoreFoods}
            disabled={isImporting}
            className="flex items-center gap-2 text-xs"
          >
            {isImporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            Import more foods
          </Button>
        </div>
      )}
    </div>
  )
}
