'use client'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  NUTRIENT_LABELS,
  nutrientUnit,
  type NutrientKey,
} from '@/lib/canine-nutrition'
import { getUserDogs } from '@/lib/dog-actions'
import { createDogMeal } from '@/lib/meal-actions'
import type { Dog, Food, MealType } from '@/lib/types'
import { AlertTriangle, ArrowLeft, Loader2, Plus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

const NUTRIENT_GROUPS: Array<{ title: string; keys: NutrientKey[] }> = [
  { title: 'Macros', keys: ['protein_g', 'fat_g'] },
  {
    title: 'Minerals',
    keys: [
      'calcium_mg',
      'phosphorus_mg',
      'potassium_mg',
      'sodium_mg',
      'magnesium_mg',
      'iron_mg',
      'copper_mg',
      'manganese_mg',
      'zinc_mg',
      'iodine_mcg',
      'selenium_mcg',
    ],
  },
  {
    title: 'Vitamins',
    keys: [
      'vitamin_a_mcg',
      'vitamin_d_iu',
      'vitamin_e_mg',
      'vitamin_b12_mcg',
      'folate_mcg',
      'choline_mg',
    ],
  },
  {
    title: 'Amino acids',
    keys: ['taurine_mg', 'methionine_cystine_mg', 'lysine_mg', 'tryptophan_mg'],
  },
  { title: 'Fatty acids', keys: ['omega3_epa_dha_mg', 'omega6_la_mg'] },
]

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

export function FoodDetailsView({ foodId }: { foodId: string }) {
  const router = useRouter()
  const [food, setFood] = useState<Food | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Determined client-side in an effect to avoid a hydration mismatch
  const [isGuest, setIsGuest] = useState(false)
  const [dogs, setDogs] = useState<Dog[]>([])
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null)
  const [mealType, setMealType] = useState<MealType>('breakfast')
  const [grams, setGrams] = useState('100')
  const [isLogging, setIsLogging] = useState(false)

  useEffect(() => {
    async function loadFood() {
      try {
        const response = await fetch(`/api/foods/${foodId}`)
        if (response.status === 404) {
          setNotFound(true)
          return
        }
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Failed to load food')
        setFood(data.food)
      } catch (error) {
        console.error('Error loading food:', error)
        toast.error('Failed to load food details')
      } finally {
        setIsLoading(false)
      }
    }
    loadFood()
  }, [foodId])

  useEffect(() => {
    const guest = document.cookie.includes('guestMode=true')
    setIsGuest(guest)
    if (guest) return

    getUserDogs()
      .then(userDogs => {
        setDogs(userDogs)
        setSelectedDogId(userDogs[0]?.id ?? null)
      })
      .catch(error => console.error('Error loading dogs:', error))
  }, [])

  const handleLogToMeal = async () => {
    if (!selectedDogId || !food) return
    const gramsValue = Number(grams)
    if (!gramsValue || gramsValue <= 0) {
      toast.error('Enter a gram amount greater than 0')
      return
    }

    setIsLogging(true)
    try {
      const result = await createDogMeal(selectedDogId, mealType, [
        { ingredient_id: food.id, grams: gramsValue },
      ])
      toast.success(
        `Logged ${gramsValue}g of ${food.name} — ${Math.round(
          result.mealKcal
        )} kcal`
      )
    } catch (error) {
      console.error('Error logging to meal:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to log to meal'
      )
    } finally {
      setIsLogging(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  if (notFound || !food) {
    return (
      <div className="py-12 text-center">
        <h2 className="mb-4 text-2xl font-semibold">Food not found</h2>
        <p className="mb-6 text-muted-foreground">
          The food you&apos;re looking for doesn&apos;t exist or has been
          removed.
        </p>
        <Button asChild>
          <Link href="/foods">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Browse Foods
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <div>
          <h1 className="mb-2 flex items-center gap-2 text-2xl font-semibold">
            {food.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
            <span>
              {food.calories_per_serving} kcal per {food.serving_size}
              {food.serving_unit}
            </span>
            {food.preparation_state && (
              <Badge variant="outline">{food.preparation_state}</Badge>
            )}
            {food.brand && food.brand !== 'USDA' && (
              <Badge variant="outline">{food.brand}</Badge>
            )}
            {food.is_verified && <Badge variant="secondary">Verified</Badge>}
          </div>
        </div>
      </div>

      {food.is_safe_for_dogs === false && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unsafe for dogs</AlertTitle>
          <AlertDescription>
            {food.toxicity_note ??
              'This ingredient is flagged as unsafe for dogs.'}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {NUTRIENT_GROUPS.map(group => {
          const rows = group.keys
            .map(key => ({ key, value: food[key] as number | undefined }))
            .filter(row => typeof row.value === 'number' && row.value > 0)

          if (rows.length === 0) return null

          return (
            <Card key={group.title}>
              <CardHeader>
                <CardTitle className="text-lg">{group.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {rows.map(row => (
                    <div
                      key={row.key}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="text-muted-foreground">
                        {NUTRIENT_LABELS[row.key]}
                      </span>
                      <span className="font-medium">
                        {Math.round((row.value as number) * 100) / 100}{' '}
                        {nutrientUnit(row.key)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Log to a dog&apos;s meal</CardTitle>
        </CardHeader>
        <CardContent>
          {isGuest ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Sign in to log this ingredient to one of your dogs.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/auth/login')}
              >
                Sign In
              </Button>
            </div>
          ) : dogs.length === 0 ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Add a dog to start logging meals.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dogs">Add a dog</Link>
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 space-y-1">
                <label className="text-sm text-muted-foreground">Dog</label>
                <Select
                  value={selectedDogId ?? undefined}
                  onValueChange={setSelectedDogId}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dogs.map(dog => (
                      <SelectItem key={dog.id} value={dog.id}>
                        {dog.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-32 space-y-1">
                <label className="text-sm text-muted-foreground">Meal</label>
                <Select
                  value={mealType}
                  onValueChange={v => setMealType(v as MealType)}
                >
                  <SelectTrigger className="capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEAL_TYPES.map(type => (
                      <SelectItem key={type} value={type} className="capitalize">
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24 space-y-1">
                <label className="text-sm text-muted-foreground">Grams</label>
                <Input
                  type="number"
                  min="1"
                  value={grams}
                  onChange={e => setGrams(e.target.value)}
                />
              </div>
              <Button onClick={handleLogToMeal} disabled={isLogging}>
                {isLogging ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Log
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
