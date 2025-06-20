"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Utensils } from "lucide-react"
import { UnifiedFoodSearch } from "./unified-food-search"
import { MealItemCard } from "./meal-item-card"
import type { Meal, MealType } from "@/lib/types"

interface MealSectionProps {
  mealType: MealType
  meal?: Meal
  onUpdate: () => void
}

export function MealSection({ mealType, meal, onUpdate }: MealSectionProps) {
  const [isSearchOpen, setIsSearchOpen] = React.useState(false)

  const mealItems = meal?.meal_items || []
  const totalCalories = mealItems.reduce((sum, item) => sum + item.calories, 0)

  const getMealIcon = (type: MealType) => {
    switch (type) {
      case "breakfast":
        return "🌅"
      case "lunch":
        return "☀️"
      case "dinner":
        return "🌙"
      case "snack":
        return "🍎"
      default:
        return "🍽️"
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span>{getMealIcon(mealType)}</span>
            <span className="capitalize">{mealType}</span>
            {totalCalories > 0 && (
              <span className="text-sm font-normal text-muted-foreground">({Math.round(totalCalories)} cal)</span>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Food
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Meal Items */}
        {mealItems.length > 0 ? (
          <div className="space-y-2">
            {mealItems.map((item) => (
              <MealItemCard key={item.id} item={item} onUpdate={onUpdate} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Utensils className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No foods added yet</p>
            <p className="text-sm">Click "Add Food" to get started</p>
          </div>
        )}

        {/* Food Search */}
        {isSearchOpen && (
          <div className="border-t pt-4">
            <UnifiedFoodSearch
              mealType={mealType}
              onFoodAdded={() => {
                setIsSearchOpen(false)
                onUpdate()
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
