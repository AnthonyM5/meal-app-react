import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import type { Meal } from '../lib/supabase'

export function useFoodActions() {
  const { isGuest } = useAuth()

  const getTodaysMeals = async (): Promise<Meal[]> => {
    if (isGuest) {
      return []
    }

    try {
      const today = new Date().toISOString().split('T')[0]

      const { data: meals, error } = await supabase
        .from('meals')
        .select(`
          *,
          meal_items (
            *,
            food:foods (*)
          )
        `)
        .eq('date', today)
        .order('created_at', { ascending: true })

      if (error) throw error
      return meals || []
    } catch (error) {
      console.error('Error loading meals:', error)
      return []
    }
  }

  return {
    getTodaysMeals,
  }
}