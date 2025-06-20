"use client"

import { useState } from "react"
import { Search, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import type { Food } from "@/lib/types"

interface NutrientSearchProps {
  onFoodSelect?: (food: Food) => void
}

const NUTRIENTS = [
  { value: "iron", label: "Iron", unit: "mg", color: "bg-red-100 text-red-800" },
  { value: "calcium", label: "Calcium", unit: "mg", color: "bg-blue-100 text-blue-800" },
  { value: "vitamin_c", label: "Vitamin C", unit: "mg", color: "bg-orange-100 text-orange-800" },
  { value: "potassium", label: "Potassium", unit: "mg", color: "bg-purple-100 text-purple-800" },
  { value: "selenium", label: "Selenium", unit: "mcg", color: "bg-green-100 text-green-800" },
  { value: "protein", label: "Protein", unit: "g", color: "bg-indigo-100 text-indigo-800" },
  { value: "fiber", label: "Fiber", unit: "g", color: "bg-yellow-100 text-yellow-800" },
]

export function NutrientSearch({ onFoodSelect }: NutrientSearchProps) {
  const [selectedNutrient, setSelectedNutrient] = useState("")
  const [minAmount, setMinAmount] = useState("")
  const [foods, setFoods] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const handleSearch = async () => {
    if (!selectedNutrient) return

    setIsSearching(true)
    try {
      const response = await fetch(`/api/foods/nutrient-search?nutrient=${selectedNutrient}&min=${minAmount || 0}`)
      const data = await response.json()
      setFoods(data.foods || [])
    } catch (error) {
      console.error("Nutrient search error:", error)
    } finally {
      setIsSearching(false)
    }
  }

  const selectedNutrientInfo = NUTRIENTS.find((n) => n.value === selectedNutrient)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Find Foods High in Specific Nutrients
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Select value={selectedNutrient} onValueChange={setSelectedNutrient}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select nutrient" />
            </SelectTrigger>
            <SelectContent>
              {NUTRIENTS.map((nutrient) => (
                <SelectItem key={nutrient.value} value={nutrient.value}>
                  {nutrient.label} ({nutrient.unit})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="number"
            placeholder={`Min ${selectedNutrientInfo?.unit || "amount"}`}
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            className="w-32"
          />

          <Button onClick={handleSearch} disabled={!selectedNutrient || isSearching}>
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {foods.length > 0 && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            <div className="text-sm text-muted-foreground">
              Found {foods.length} foods high in {selectedNutrientInfo?.label}
            </div>

            {foods.map((food) => (
              <Card
                key={food.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onFoodSelect?.(food)}
              >
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
                      </div>

                      <div className="text-sm text-muted-foreground">
                        {Math.round(food.calories_per_serving)} cal per {food.serving_size}
                        {food.serving_unit}
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={selectedNutrientInfo?.color}>
                          {Math.round(food.nutrient_amount * 100) / 100} {food.nutrient_unit}{" "}
                          {selectedNutrientInfo?.label}
                        </Badge>

                        <div className="text-xs text-muted-foreground">
                          P: {Math.round(food.protein_g)}g • C: {Math.round(food.carbs_g)}g • F:{" "}
                          {Math.round(food.fat_g)}g
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
