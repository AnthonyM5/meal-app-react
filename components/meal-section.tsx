"use client"

import React from "react"
import { FoodSearch } from "./food-search"

interface MealSectionProps {
  mealType: string
  meal: any // TODO: Define meal type
  onUpdate: () => void
}

export function MealSection({ mealType, meal, onUpdate }: MealSectionProps) {
  const [isSearchOpen, setIsSearchOpen] = React.useState(false)

  return (
    <div>
      <h3>{mealType}</h3>
      <FoodSearch
        mealType={mealType}
        onFoodAdded={() => {
          setIsSearchOpen(false)
          onUpdate()
        }}
      />
    </div>
  )
}
