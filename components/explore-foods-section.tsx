'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { Food } from '@/lib/types'
import { ExternalLink, Loader2, Search } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export function ExploreFoodsSection() {
  const [query, setQuery] = useState('')
  const [foods, setFoods] = useState<Food[]>([])
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (query.length >= 2) {
        setIsSearching(true)
        try {
          const response = await fetch(
            `/api/foods/unified-search?q=${encodeURIComponent(query)}`
          )
          const data = await response.json()
          setFoods(data.foods || [])
        } catch (error) {
          console.error('Search error:', error)
        } finally {
          setIsSearching(false)
        }
      } else {
        setFoods([])
      }
    }, 300)

    return () => clearTimeout(searchTimeout)
  }, [query])

  const getSourceBadge = (food: Food) => {
    if (food.brand === 'USDA')
      return { label: 'USDA', variant: 'default' as const }
    if (food.is_verified)
      return { label: 'Verified', variant: 'secondary' as const }
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Explore Foods</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search foods and explore nutrition info..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-10"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin" />
          )}
        </div>

        {foods.length > 0 && (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {foods.map(food => {
              const sourceBadge = getSourceBadge(food)
              return (
                <Link
                  key={food.id}
                  href={`/food-details/${food.id}`}
                  className="block"
                >
                  <Card className="hover:shadow-md transition-shadow hover:bg-accent">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium flex items-center gap-1">
                          {food.name}
                          <ExternalLink className="h-3 w-3" />
                        </span>
                        {food.brand && food.brand !== 'USDA' && (
                          <Badge variant="outline" className="text-xs">
                            {food.brand}
                          </Badge>
                        )}
                        {sourceBadge && (
                          <Badge
                            variant={sourceBadge.variant}
                            className="text-xs"
                          >
                            {sourceBadge.label}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {Math.round(food.calories_per_serving)} cal per{' '}
                        {food.serving_size}
                        {food.serving_unit}
                      </div>
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        <div className="text-center p-2 bg-muted/50 rounded">
                          <div className="font-semibold">
                            {Math.round(food.protein_g)}g
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Protein
                          </div>
                        </div>
                        <div className="text-center p-2 bg-muted/50 rounded">
                          <div className="font-semibold">
                            {Math.round(food.carbs_g)}g
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Carbs
                          </div>
                        </div>
                        <div className="text-center p-2 bg-muted/50 rounded">
                          <div className="font-semibold">
                            {Math.round(food.fat_g)}g
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Fat
                          </div>
                        </div>
                        <div className="text-center p-2 bg-muted/50 rounded">
                          <div className="font-semibold">
                            {Math.round(food.fiber_g)}g
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Fiber
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}

        {query.length >= 2 && foods.length === 0 && !isSearching && (
          <div className="text-center py-8 text-muted-foreground">
            No foods found for "{query}"
          </div>
        )}
      </CardContent>
    </Card>
  )
}
