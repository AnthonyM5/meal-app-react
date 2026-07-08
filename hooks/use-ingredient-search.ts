'use client'

import type { Food } from '@/lib/types'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

/** Minimum query length before we hit the search endpoint. */
const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 300

/**
 * Debounced ingredient search against /api/foods/unified-search.
 * Shared by the meal builder and the bowl-photo confirmation UI so both
 * surfaces search the same way.
 */
export function useIngredientSearch(query: string) {
  const [results, setResults] = useState<Food[]>([])
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    if (query.length < MIN_QUERY_LENGTH) {
      setResults([])
      setIsSearching(false)
      return
    }

    let cancelled = false
    const timeout = setTimeout(async () => {
      setIsSearching(true)
      try {
        const response = await fetch(
          `/api/foods/unified-search?q=${encodeURIComponent(query)}`
        )
        const data = await response.json()
        if (!cancelled) setResults(data.foods || [])
      } catch (error) {
        console.error('Ingredient search error:', error)
        if (!cancelled) toast.error('Failed to search ingredients')
      } finally {
        if (!cancelled) setIsSearching(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [query])

  return { results, isSearching }
}
