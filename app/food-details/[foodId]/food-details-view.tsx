'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { addFoodToMeal } from '@/lib/food-actions'
import type { Food, MealType } from '@/lib/types'
import { createClient } from '@supabase/supabase-js'
import { ArrowLeft, Loader2, Plus } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

// Define nutrient categories and their associated properties
const NUTRIENT_CATEGORIES = [
  {
    title: 'Macros',
    nutrients: [
      { key: 'protein_g', label: 'Protein', unit: 'g' },
      { key: 'carbs_g', label: 'Carbs', unit: 'g' },
      { key: 'fat_g', label: 'Fat', unit: 'g' },
      { key: 'fiber_g', label: 'Fiber', unit: 'g' },
    ],
  },
  {
    title: 'Vitamins',
    nutrients: [
      { key: 'vitamin_a_mcg', label: 'Vitamin A', unit: 'mcg' },
      { key: 'vitamin_c_mg', label: 'Vitamin C', unit: 'mg' },
      { key: 'vitamin_d_mcg', label: 'Vitamin D', unit: 'mcg' },
      { key: 'vitamin_e_mg', label: 'Vitamin E', unit: 'mg' },
      { key: 'vitamin_b12_mcg', label: 'Vitamin B12', unit: 'mcg' },
    ],
  },
  {
    title: 'Minerals',
    nutrients: [
      { key: 'calcium_mg', label: 'Calcium', unit: 'mg' },
      { key: 'iron_mg', label: 'Iron', unit: 'mg' },
      { key: 'magnesium_mg', label: 'Magnesium', unit: 'mg' },
      { key: 'potassium_mg', label: 'Potassium', unit: 'mg' },
      { key: 'zinc_mg', label: 'Zinc', unit: 'mg' },
    ],
  },
  {
    title: 'Other',
    nutrients: [
      { key: 'sugar_g', label: 'Sugar', unit: 'g' },
      { key: 'sodium_mg', label: 'Sodium', unit: 'mg' },
      { key: 'cholesterol_mg', label: 'Cholesterol', unit: 'mg' },
      { key: 'folate_mcg', label: 'Folate', unit: 'mcg' },
      { key: 'selenium_mcg', label: 'Selenium', unit: 'mcg' },
    ],
  },
]

export function FoodDetailsView({ foodId }: { foodId: string }) {
  const [food, setFood] = useState<Food | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAddingToMeal, setIsAddingToMeal] = useState(false)
  const [showMealTypeSelect, setShowMealTypeSelect] = useState(false)
  const [selectedMealType, setSelectedMealType] =
    useState<MealType>('breakfast')

  useEffect(() => {
    async function loadFood() {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL as string,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
      )
      const { data, error } = await supabase
        .from('foods')
        .select('*')
        .eq('id', foodId)
        .single()

      if (error) {
        console.error('Error loading food:', error)
        toast.error('Failed to load food details')
        return
      }

      setFood(data)
      setIsLoading(false)
    }

    loadFood()
  }, [foodId])

  const handleAddToMeal = async () => {
    if (!selectedMealType || !food) return

    setIsAddingToMeal(true)
    try {
      await addFoodToMeal(food.id, selectedMealType)
      toast.success(`Added ${food.name} to ${selectedMealType}`)
      setShowMealTypeSelect(false)
    } catch (error) {
      console.error('Error adding food to meal:', error)
      toast.error('Failed to add food to meal')
    } finally {
      setIsAddingToMeal(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  if (!food) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold mb-4">Food not found</h2>
        <p className="text-muted-foreground mb-6">
          The food you're looking for doesn't exist or has been removed.
        </p>
        <Button asChild>
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-2">{food.name}</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>
              {food.calories_per_serving} calories per {food.serving_size}
              {food.serving_unit}
            </span>
            {food.brand && food.brand !== 'USDA' && (
              <Badge variant="outline">{food.brand}</Badge>
            )}
            {food.brand === 'USDA' && <Badge>USDA</Badge>}
            {food.is_verified && <Badge variant="secondary">Verified</Badge>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showMealTypeSelect ? (
            <>
              <Select
                value={selectedMealType}
                onValueChange={(value: string) =>
                  setSelectedMealType(value as MealType)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select meal type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="breakfast">Breakfast</SelectItem>
                  <SelectItem value="lunch">Lunch</SelectItem>
                  <SelectItem value="dinner">Dinner</SelectItem>
                  <SelectItem value="snack">Snack</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleAddToMeal} disabled={isAddingToMeal}>
                {isAddingToMeal ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Add
              </Button>
            </>
          ) : (
            <Button onClick={() => setShowMealTypeSelect(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add to Meal
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {NUTRIENT_CATEGORIES.map(category => (
          <Card key={category.title}>
            <CardHeader>
              <CardTitle className="text-lg">{category.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {category.nutrients.map(nutrient => {
                  const value = food[nutrient.key as keyof Food]
                  if (typeof value !== 'number') return null
                  if (value === 0) return null

                  return (
                    <div
                      key={nutrient.key}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="text-muted-foreground">
                        {nutrient.label}
                      </span>
                      <span className="font-medium">
                        {Math.round(value * 100) / 100} {nutrient.unit}
                      </span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
