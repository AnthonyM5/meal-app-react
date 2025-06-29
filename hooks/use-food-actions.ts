'use client'

import { useGuestMode } from '@/hooks/use-guest-mode'
import { useToast } from '@/hooks/use-toast'
import * as actions from '@/lib/food-actions'

export function useFoodActions() {
  const { isGuest } = useGuestMode()
  const { toast } = useToast()

  const handleGuestError = () => {
    toast({
      title: 'Action not available in guest mode',
      description: 'Please sign in to use this feature',
      variant: 'destructive',
    })
  }

  return {
    addFoodToMeal: async (
      ...args: Parameters<typeof actions.addFoodToMeal>
    ) => {
      if (isGuest) {
        handleGuestError()
        return null
      }
      return actions.addFoodToMeal(...args)
    },

    removeFoodFromMeal: async (
      ...args: Parameters<typeof actions.removeFoodFromMeal>
    ) => {
      if (isGuest) {
        handleGuestError()
        return null
      }
      return actions.removeFoodFromMeal(...args)
    },

    createMeal: async (...args: Parameters<typeof actions.createMeal>) => {
      if (isGuest) {
        handleGuestError()
        return null
      }
      return actions.createMeal(...args)
    },

    deleteMeal: async (...args: Parameters<typeof actions.deleteMeal>) => {
      if (isGuest) {
        handleGuestError()
        return null
      }
      return actions.deleteMeal(...args)
    },

    getTodaysMeals: async () => {
      if (isGuest) {
        return []
      }
      return actions.getTodaysMeals()
    },
  }
}
