import type { Food } from '@pawplate/core'
import {
  NUTRIENT_LABELS,
  TRACKED_NUTRIENTS,
  nutrientUnit,
  type NutrientKey,
} from '@pawplate/core'
import type { FoodByNutrient } from '@pawplate/api-client'
import { Badge } from '@pawplate/ui/badge'
import { Button } from '@pawplate/ui/button'
import { Card, CardContent } from '@pawplate/ui/card'
import { Input } from '@pawplate/ui/input'
import { Label } from '@pawplate/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pawplate/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@pawplate/ui/tabs'
import { AlertTriangle, Loader2, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { api } from '../lib/api'

// Sorted alphabetically by label for the picker.
const NUTRIENT_OPTIONS = [...TRACKED_NUTRIENTS].sort((a, b) =>
  NUTRIENT_LABELS[a].localeCompare(NUTRIENT_LABELS[b])
)

function ResultCard({
  food,
  nutrientKey,
}: {
  food: Food & { nutrient_amount?: number }
  nutrientKey?: NutrientKey
}) {
  return (
    <Link to={`/foods/${food.id}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="space-y-2 p-4">
          <h3 className="flex items-center gap-1.5 font-medium leading-tight">
            {food.name}
            {food.is_safe_for_dogs === false && (
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
            )}
          </h3>
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
            {Math.round(food.protein_g)}g · F {Math.round(food.fat_g)}g per 100g
          </p>
          {nutrientKey && food.nutrient_amount != null && (
            <p className="text-sm font-medium text-primary">
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
  const [results, setResults] = useState<Food[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setHasSearched(false)
      return
    }
    let cancelled = false
    const timeout = setTimeout(async () => {
      setIsSearching(true)
      setHasSearched(true)
      try {
        const foods = await api.foods.search(query)
        if (!cancelled) setResults(foods)
      } catch (error) {
        if (!cancelled) toast.error((error as Error).message)
      } finally {
        if (!cancelled) setIsSearching(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [query])

  return (
    <div className="space-y-4">
      <div className="relative">
        <Input
          type="text"
          placeholder="Search by name (e.g. chicken, sweet potato)…"
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
        <div className="space-y-3">
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
  const [results, setResults] = useState<FoodByNutrient[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  async function handleSearch() {
    setIsSearching(true)
    setHasSearched(true)
    try {
      const foods = await api.foods.searchByNutrient(
        nutrientKey,
        Number(minAmount) || 0
      )
      setResults(foods)
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Nutrient</Label>
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
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label>Min amount (optional)</Label>
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
        Values are per 100 g, as fed (raw and cooked entries are separate — check
        the badge on each card).
      </p>

      {hasSearched && !isSearching && results.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          No ingredients found with {NUTRIENT_LABELS[nutrientKey].toLowerCase()}
          {minAmount ? ` ≥ ${minAmount} ${nutrientUnit(nutrientKey)}` : ''}.
        </p>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          {results.map(food => (
            <ResultCard key={food.id} food={food} nutrientKey={nutrientKey} />
          ))}
        </div>
      )}
    </div>
  )
}

export function FoodsScreen() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Browse foods</h1>
        <p className="text-sm text-muted-foreground">
          Search the ingredient database by name or find foods highest in a
          specific nutrient.
        </p>
      </div>

      <Tabs defaultValue="name">
        <TabsList className="w-full">
          <TabsTrigger value="name" className="flex-1">
            By name
          </TabsTrigger>
          <TabsTrigger value="nutrient" className="flex-1">
            By nutrient
          </TabsTrigger>
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
