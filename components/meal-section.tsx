'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useGuestMode } from '@/hooks/use-guest-mode'
import { useToast } from '@/hooks/use-toast'
import type { Meal, MealType } from '@/lib/types'
import { Plus } from 'lucide-react'
import React from 'react'
import { MealItemCard } from './meal-item-card'
import { UnifiedFoodSearch } from './unified-food-search'

interface MealSectionProps {
  mealType: MealType
  meal?: Meal
  onUpdate: () => void
}

export function MealSection({ mealType, meal, onUpdate }: MealSectionProps) {
  const [isSearchOpen, setIsSearchOpen] = React.useState(false)
  const { isGuest } = useGuestMode()
  const { toast } = useToast()

  const mealItems = meal?.meal_items || []
  const totalCalories = mealItems.reduce((sum, item) => sum + item.calories, 0)

  const handleAddClick = () => {
    if (isGuest) {
      toast({
        title: 'Action not available in guest mode',
        description: 'Please sign in to add foods to meals',
        variant: 'destructive',
      })
      return
    }
    setIsSearchOpen(true)
  }

  const getMealIcon = (type: MealType) => {
    switch (type) {
      case 'breakfast':
        return '🌅'
      case 'lunch':
        return '☀️'
      case 'dinner':
        return '🌙'
      case 'snack':
        return '🍎'
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {getMealIcon(mealType)}{' '}
          {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
          {!isGuest && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {totalCalories} cal
            </span>
          )}
        </CardTitle>
        {!isGuest && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleAddClick}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isSearchOpen && !isGuest && (
          <div className="mb-4">
            <UnifiedFoodSearch
              mealType={mealType}
              onFoodAdded={() => {
                setIsSearchOpen(false)
                onUpdate()
              }}
            />
          </div>
        )}

        {!isGuest && mealItems.length === 0 && (
          <p className="text-sm text-center text-muted-foreground py-8">
            No foods added yet
          </p>
        )}

        {!isGuest &&
          mealItems.map(item => (
            <MealItemCard key={item.id} item={item} onUpdate={onUpdate} />
          ))}

        {isGuest && (
          <p className="text-sm text-center text-muted-foreground py-8">
            Sign in to track your meals
          </p>
        )}
      </CardContent>
    </Card>
  )
}
