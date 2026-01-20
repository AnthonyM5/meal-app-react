'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import type { Food } from '@/lib/types'
import { Loader2, Plus, Search, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

interface RecipeIngredientInput {
  food: Food
  quantity: number
  unit: string
}

interface RecipeBuilderProps {
  onSave: (recipe: {
    name: string
    description: string
    ingredients: Array<{ food_id: string; quantity: number; unit: string }>
    servings: number
    isPublic: boolean
  }) => Promise<void>
  onCancel?: () => void
}

export function RecipeBuilder({ onSave, onCancel }: RecipeBuilderProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [servings, setServings] = useState(1)
  const [ingredients, setIngredients] = useState<RecipeIngredientInput[]>([])
  const [isPublic, setIsPublic] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Food search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Food[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Search for foods
  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setIsSearching(true)
        try {
          const response = await fetch(
            `/api/foods/unified-search?q=${encodeURIComponent(searchQuery)}`
          )
          const data = await response.json()
          setSearchResults(data.foods || [])
        } catch (error) {
          console.error('Search error:', error)
          toast.error('Failed to search foods')
        } finally {
          setIsSearching(false)
        }
      } else {
        setSearchResults([])
      }
    }, 300)

    return () => clearTimeout(searchTimeout)
  }, [searchQuery])

  // Handle click outside search dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearchFocused(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const addIngredient = (food: Food) => {
    setIngredients([
      ...ingredients,
      {
        food,
        quantity: 1,
        unit: food.serving_unit || 'serving',
      },
    ])
    setSearchQuery('')
    setSearchResults([])
    setIsSearchFocused(false)
  }

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index))
  }

  const updateIngredient = (
    index: number,
    field: 'quantity' | 'unit',
    value: number | string
  ) => {
    const updated = [...ingredients]
    if (field === 'quantity') {
      updated[index] = { ...updated[index], quantity: value as number }
    } else {
      updated[index] = { ...updated[index], unit: value as string }
    }
    setIngredients(updated)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter a recipe name')
      return
    }

    if (ingredients.length === 0) {
      toast.error('Please add at least one ingredient')
      return
    }

    if (servings <= 0) {
      toast.error('Servings must be greater than 0')
      return
    }

    setIsSaving(true)
    try {
      const ingredientsData = ingredients.map(ing => ({
        food_id: ing.food.id,
        quantity: ing.quantity,
        unit: ing.unit,
      }))

      await onSave({
        name: name.trim(),
        description: description.trim(),
        ingredients: ingredientsData,
        servings,
        isPublic,
      })

      toast.success('Recipe saved successfully')
    } catch (error) {
      console.error('Save recipe error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save recipe')
    } finally {
      setIsSaving(false)
    }
  }

  // Calculate estimated nutrition for preview
  const calculateTotalNutrition = () => {
    const totals = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
    }

    for (const ing of ingredients) {
      const multiplier = ing.quantity
      totals.calories += ing.food.calories_per_serving * multiplier
      totals.protein += ing.food.protein_g * multiplier
      totals.carbs += ing.food.carbs_g * multiplier
      totals.fat += ing.food.fat_g * multiplier
      totals.fiber += ing.food.fiber_g * multiplier
    }

    return totals
  }

  const totalNutrition = calculateTotalNutrition()
  const perServingNutrition = {
    calories: servings > 0 ? totalNutrition.calories / servings : 0,
    protein: servings > 0 ? totalNutrition.protein / servings : 0,
    carbs: servings > 0 ? totalNutrition.carbs / servings : 0,
    fat: servings > 0 ? totalNutrition.fat / servings : 0,
    fiber: servings > 0 ? totalNutrition.fiber / servings : 0,
  }

  return (
    <div className="space-y-6">
      {/* Recipe Name */}
      <div className="space-y-2">
        <Label htmlFor="recipe-name">Recipe Name</Label>
        <Input
          id="recipe-name"
          placeholder="e.g., PB&J Sandwich"
          value={name}
          onChange={e => setName(e.target.value)}
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="recipe-description">Description (optional)</Label>
        <Input
          id="recipe-description"
          placeholder="A short description of this recipe"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>

      {/* Servings */}
      <div className="space-y-2">
        <Label htmlFor="recipe-servings">Number of Servings</Label>
        <Input
          id="recipe-servings"
          type="number"
          min="0.25"
          step="0.25"
          value={servings}
          onChange={e => setServings(parseFloat(e.target.value) || 1)}
          className="w-24"
        />
      </div>

      {/* Ingredients List */}
      <div className="space-y-2">
        <Label>Ingredients</Label>
        {ingredients.length > 0 ? (
          <div className="space-y-2">
            {ingredients.map((ing, idx) => (
              <Card key={idx}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{ing.food.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {Math.round(ing.food.calories_per_serving * ing.quantity)} cal
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={ing.quantity}
                        onChange={e =>
                          updateIngredient(
                            idx,
                            'quantity',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-20"
                        step="0.25"
                        min="0.25"
                      />
                      <Input
                        value={ing.unit}
                        onChange={e => updateIngredient(idx, 'unit', e.target.value)}
                        className="w-24"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeIngredient(idx)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No ingredients added yet. Search for foods below to add them.
          </p>
        )}
      </div>

      {/* Food Search */}
      <div ref={searchContainerRef} className="relative">
        <Label htmlFor="food-search">Add Ingredient</Label>
        <div className="relative mt-2">
          <Input
            id="food-search"
            type="text"
            placeholder="Search for a food..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
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

        {isSearchFocused && searchQuery.length > 1 && (
          <div className="absolute z-10 mt-1 w-full">
            <Card className="shadow-lg">
              <CardContent className="p-2">
                {isSearching && searchResults.length === 0 ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : searchResults.length > 0 ? (
                  <ul className="max-h-60 overflow-auto">
                    {searchResults.map(food => (
                      <li
                        key={food.id}
                        className="flex items-center justify-between rounded-md p-2 hover:bg-muted cursor-pointer"
                        onClick={() => addIngredient(food)}
                      >
                        <div>
                          <span className="font-semibold">{food.name}</span>
                          <p className="text-sm text-muted-foreground">
                            {food.calories_per_serving} kcal per {food.serving_size}{' '}
                            {food.serving_unit}
                          </p>
                        </div>
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      </li>
                    ))}
                  </ul>
                ) : (
                  !isSearching && (
                    <p className="p-4 text-center text-sm text-muted-foreground">
                      No results found for &quot;{searchQuery}&quot;.
                    </p>
                  )
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Nutrition Preview */}
      {ingredients.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="font-medium mb-2">Nutrition per Serving</h4>
            <div className="grid grid-cols-5 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground">Calories</p>
                <p className="font-medium">{Math.round(perServingNutrition.calories)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Protein</p>
                <p className="font-medium">{Math.round(perServingNutrition.protein)}g</p>
              </div>
              <div>
                <p className="text-muted-foreground">Carbs</p>
                <p className="font-medium">{Math.round(perServingNutrition.carbs)}g</p>
              </div>
              <div>
                <p className="text-muted-foreground">Fat</p>
                <p className="font-medium">{Math.round(perServingNutrition.fat)}g</p>
              </div>
              <div>
                <p className="text-muted-foreground">Fiber</p>
                <p className="font-medium">{Math.round(perServingNutrition.fiber)}g</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Public Recipe Checkbox */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="recipe-public"
          checked={isPublic}
          onCheckedChange={checked => setIsPublic(checked === true)}
        />
        <Label htmlFor="recipe-public" className="text-sm">
          Make this recipe public (others can view and use it)
        </Label>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={!name.trim() || ingredients.length === 0 || isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Recipe'
          )}
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}
