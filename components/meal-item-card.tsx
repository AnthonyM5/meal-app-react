"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Trash2, Edit3, Check, X } from "lucide-react"
import { updateMealItem, deleteMealItem } from "@/lib/food-actions"
import type { MealItem } from "@/lib/types"
import { toast } from "sonner"

interface MealItemCardProps {
  item: MealItem
  onUpdate: () => void
}

export function MealItemCard({ item, onUpdate }: MealItemCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [quantity, setQuantity] = useState(item.quantity.toString())
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleSave = async () => {
    const newQuantity = Number.parseFloat(quantity)
    if (isNaN(newQuantity) || newQuantity <= 0) {
      toast.error("Please enter a valid quantity")
      return
    }

    setIsUpdating(true)
    try {
      await updateMealItem(item.id, newQuantity)
      toast.success("Portion updated")
      setIsEditing(false)
      onUpdate()
    } catch (error) {
      console.error("Update error:", error)
      toast.error("Failed to update portion")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteMealItem(item.id)
      toast.success("Food removed")
      onUpdate()
    } catch (error) {
      console.error("Delete error:", error)
      toast.error("Failed to remove food")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCancel = () => {
    setQuantity(item.quantity.toString())
    setIsEditing(false)
  }

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium">{item.food?.name ?? item.recipe?.name ?? 'Unknown Item'}</h4>
              {item.food?.brand && item.food.brand !== "USDA" && (
                <Badge variant="outline" className="text-xs">
                  {item.food.brand}
                </Badge>
              )}
              {item.recipe && (
                <Badge variant="secondary" className="text-xs">
                  Recipe
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-20 h-8"
                    step="0.1"
                    min="0.1"
                  />
                  <span>{item.unit}</span>
                </div>
              ) : (
                <span>
                  {item.quantity} {item.unit}
                </span>
              )}

              <span>•</span>
              <span className="font-medium">{Math.round(item.calories)} cal</span>
            </div>

            <div className="text-xs text-muted-foreground mt-1">
              P: {Math.round(item.protein_g)}g • C: {Math.round(item.carbs_g)}g • F: {Math.round(item.fat_g)}g
              {item.fiber_g > 0 && ` • Fiber: ${Math.round(item.fiber_g)}g`}
            </div>
          </div>

          <div className="flex items-center gap-2 ml-4">
            {isEditing ? (
              <>
                <Button size="sm" variant="ghost" onClick={handleSave} disabled={isUpdating} className="h-8 w-8 p-0">
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancel} disabled={isUpdating} className="h-8 w-8 p-0">
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)} className="h-8 w-8 p-0">
                  <Edit3 className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
