'use client'

import { useToast } from '@/hooks/use-toast'
import * as actions from '@/lib/food-actions'

export function useFoodActions() {
  const { toast } = useToast()

  // Check guest mode directly from cookie to avoid re-renders
  const checkGuestMode = () => {
    return typeof window !== 'undefined' && document.cookie.includes('guestMode=true')
  }

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
      if (checkGuestMode()) {
        handleGuestError()
        return null
      }
      return actions.addFoodToMeal(...args)
    },

    deleteMealItem: async (
      ...args: Parameters<typeof actions.deleteMealItem>
    ) => {
      if (checkGuestMode()) {
        handleGuestError()
        return null
      }
      return actions.deleteMealItem(...args)
    },

    createMeal: async (...args: Parameters<typeof actions.createMeal>) => {
      if (checkGuestMode()) {
        handleGuestError()
        return null
      }
      return actions.createMeal(...args)
    },

    deleteMeal: async (...args: Parameters<typeof actions.deleteMeal>) => {
      if (checkGuestMode()) {
        handleGuestError()
        return null
      }
      return actions.deleteMeal(...args)
    },

    getTodaysMeals: async () => {
      if (checkGuestMode()) {
        return []
      }
      return actions.getTodaysMeals()
    },
  }
}
