import { useState } from 'react'
import { supabase, type Food } from '../lib/supabase'

export function useFoodSearch() {
  const [foods, setFoods] = useState<Food[]>([])
  const [loading, setLoading] = useState(false)

  const searchFoods = async (query: string) => {
    if (!query || query.length < 2) {
      setFoods([])
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('foods')
        .select('*')
        .or(`name.ilike.%${query}%, brand.ilike.%${query}%`)
        .limit(50)
        .order('is_verified', { ascending: false })
        .order('name')

      if (error) throw error
      setFoods(data || [])
    } catch (error) {
      console.error('Search error:', error)
      setFoods([])
    } finally {
      setLoading(false)
    }
  }

  return {
    foods,
    loading,
    searchFoods,
  }
}