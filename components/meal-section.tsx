import type React from "react"
import { EnhancedFoodSearch } from "@/components/enhanced-food-search"

interface MealSectionProps {
  mealType: string
  onRefresh: () => void
}

const MealSection: React.FC<MealSectionProps> = ({ mealType, onRefresh }) => {
  return (
    <div>
      <h3>{mealType}</h3>
      <EnhancedFoodSearch mealType={mealType} onFoodAdded={onRefresh} />
    </div>
  )
}

export default MealSection
