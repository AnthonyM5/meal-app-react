"use client"

import { useState } from "react"
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { FoodSearch } from "./food-search"
import { removeMealItem } from "@/lib/food-actions"
import type { Meal, MealType } from "@/lib/types"
import { toast } from "sonner"

interface MealSectionProps {
  mealType: MealType
  meal?: Meal
  onUpdate: () => void
}

export function MealSection({ mealType, meal, onUpdate }: MealSectionProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)

  const mealTypeLabels = {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    snack: "Snacks",
  }

  const totalCalories = meal?.meal_items?.reduce((sum, item) => sum + item.calories, 0) || 0
  const totalProtein = meal?.meal_items?.reduce((sum, item) => sum + item.protein_g, 0) || 0
  const totalCarbs = meal?.meal_items?.reduce((sum, item) => sum + item.carbs_g, 0) || 0
  const totalFat = meal?.meal_items?.reduce((sum, item) => sum + item.fat_g, 0) || 0

  const handleRemoveItem = async (itemId: string) => {
    try {
      await removeMealItem(itemId)
      toast.success("Item removed")
      onUpdate()
    } catch (error) {
      toast.error("Failed to remove item")
    }
  }

  return (
    <Card>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <CardTitle className="text-lg">{mealTypeLabels[mealType]}</CardTitle>
                {totalCalories > 0 && <Badge variant="secondary">{Math.round(totalCalories)} cal</Badge>}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsSearchOpen(!isSearchOpen)
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {isSearchOpen && (
              <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                <FoodSearch
                  mealType={mealType}
                  onFoodAdded={() => {
                    setIsSearchOpen(false)
                    onUpdate()
                  }}
                />
              </div>
            )}

            {meal?.meal_items && meal.meal_items.length > 0 ? (
              <div className="space-y-3">
                {meal.meal_items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{item.food.name}</span>
                        {item.food.brand && (
                          <Badge variant="outline" className="text-xs">
                            {item.food.brand}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {item.quantity} {item.unit} • {Math.round(item.calories)} cal
                      </div>
                      <div className="text-xs text-muted-foreground">
                        P: {Math.round(item.protein_g)}g • C: {Math.round(item.carbs_g)}g • F: {Math.round(item.fat_g)}g
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {meal.meal_items.length > 1 && (
                  <div className="pt-3 border-t">
                    <div className="flex justify-between text-sm font-medium">
                      <span>Total:</span>
                      <span>{Math.round(totalCalories)} calories</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Macros:</span>
                      <span>
                        P: {Math.round(totalProtein)}g • C: {Math.round(totalCarbs)}g • F: {Math.round(totalFat)}g
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No foods logged for {mealTypeLabels[mealType].toLowerCase()}</p>
                <Button variant="ghost" size="sm" onClick={() => setIsSearchOpen(true)} className="mt-2">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Food
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
