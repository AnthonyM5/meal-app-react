'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  NUTRIENT_LABELS,
  TRACKED_NUTRIENTS,
  nutrientUnit,
  type NutrientKey,
} from '@/lib/canine-nutrition'
import { AlertTriangle, Loader2, Search } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface FoodResult {
  id: string
  name: string
  brand?: string | null
  calories_per_serving: number
  protein_g: number
  fat_g: number
  is_safe_for_dogs?: boolean | null
  toxicity_note?: string | null
  preparation_state?: string | null
  is_verified: boolean
  /** Present only for nutrient-search results */
  nutrient_amount?: number
}

// Sorted alphabetically by label for the picker.
const NUTRIENT_OPTIONS = [...TRACKED_NUTRIENTS].sort((a, b) =>
  NUTRIENT_LABELS[a].localeCompare(NUTRIENT_LABELS[b])
)

function ResultCard({
  food,
  nutrientKey,
}: {
  food: FoodResult
  nutrientKey?: NutrientKey
}) {
  return (
    <Link href={`/food-details/${food.id}`} data-testid="food-result-card">
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardContent className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="flex items-center gap-1.5 font-medium leading-tight">
              {food.name}
              {food.is_safe_for_dogs === false && (
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
              )}
            </h3>
          </div>
          <div className="flex flex-wrap gap-1">
            {food.preparation_state && (
              <Badge variant="outline" className="text-xs font-normal">
                {food.preparation_state}
              </Badge>
            )}
            {food.brand && food.brand !== 'USDA' && (
              <Badge variant="outline" className="text-xs font-normal">
                {food.brand}
              </Badge>
            )}
            {food.is_verified && (
              <Badge variant="secondary" className="text-xs font-normal">
                Verified
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {Math.round(food.calories_per_serving)} kcal · P{' '}
            {Math.round(food.protein_g)}g · F {Math.round(food.fat_g)}g
            {' '}per 100g
          </p>
          {nutrientKey && food.nutrient_amount != null && (
            <p
              className="text-sm font-medium text-primary"
              data-testid="nutrient-amount"
            >
              {Math.round(food.nutrient_amount * 100) / 100}{' '}
              {nutrientUnit(nutrientKey)} {NUTRIENT_LABELS[nutrientKey]}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

function NameSearchTab() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoodResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (query.length < 2) {
        setResults([])
        setHasSearched(false)
        return
      }
      setIsSearching(true)
      setHasSearched(true)
      try {
        const response = await fetch(
          `/api/foods/unified-search?q=${encodeURIComponent(query)}`
        )
        const data = await response.json()
        setResults(data.foods || [])
      } catch (error) {
        console.error('Food search error:', error)
        toast.error('Failed to search foods')
      } finally {
        setIsSearching(false)
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [query])

  return (
    <div className="space-y-4">
      <div className="relative">
        <Input
          type="text"
          placeholder="Search ingredients by name (e.g. chicken, sweet potato)..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="pr-10"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          {isSearching ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <Search className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </div>

      {hasSearched && !isSearching && results.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          No ingredients found for &quot;{query}&quot;.
        </p>
      )}

      {results.length > 0 && (
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="name-results"
        >
          {results.map(food => (
            <ResultCard key={food.id} food={food} />
          ))}
        </div>
      )}
    </div>
  )
}

function NutrientSearchTab() {
  const [nutrientKey, setNutrientKey] = useState<NutrientKey>('lysine_mg')
  const [minAmount, setMinAmount] = useState('')
  const [results, setResults] = useState<FoodResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = async () => {
    setIsSearching(true)
    setHasSearched(true)
    try {
      const response = await fetch(
        `/api/foods/nutrient-search?nutrient=${nutrientKey}&min=${minAmount || 0}`
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Search failed')
      setResults(data.foods || [])
    } catch (error) {
      console.error('Nutrient search error:', error)
      toast.error('Failed to search by nutrient')
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 space-y-1">
          <label className="text-sm text-muted-foreground">Nutrient</label>
          <Select
            value={nutrientKey}
            onValueChange={v => setNutrientKey(v as NutrientKey)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NUTRIENT_OPTIONS.map(key => (
                <SelectItem key={key} value={key}>
                  {NUTRIENT_LABELS[key]} ({nutrientUnit(key)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-36 space-y-1">
          <label className="text-sm text-muted-foreground">
            Min amount (optional)
          </label>
          <Input
            type="number"
            min="0"
            placeholder="0"
            value={minAmount}
            onChange={e => setMinAmount(e.target.value)}
          />
        </div>
        <Button onClick={handleSearch} disabled={isSearching}>
          {isSearching ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          Search
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Values are per 100 g, as fed (raw or cooked entries are separate —
        check the badge on each card).
      </p>

      {hasSearched && !isSearching && results.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          No ingredients found with {NUTRIENT_LABELS[nutrientKey].toLowerCase()}
          {minAmount ? ` ≥ ${minAmount} ${nutrientUnit(nutrientKey)}` : ''}.
        </p>
      )}

      {results.length > 0 && (
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="nutrient-results"
        >
          {results.map(food => (
            <ResultCard key={food.id} food={food} nutrientKey={nutrientKey} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function FoodsPage() {
  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-4 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Browse Foods</h1>
          <p className="text-sm text-muted-foreground">
            Search the ingredient database by name or find foods highest in a
            specific nutrient.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </div>

      <Tabs defaultValue="name">
        <TabsList>
          <TabsTrigger value="name">Search by name</TabsTrigger>
          <TabsTrigger value="nutrient">Search by nutrient</TabsTrigger>
        </TabsList>
        <TabsContent value="name" className="pt-4">
          <NameSearchTab />
        </TabsContent>
        <TabsContent value="nutrient" className="pt-4">
          <NutrientSearchTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
