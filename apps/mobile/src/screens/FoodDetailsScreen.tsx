import type { Dog, Food, MealType } from '@pawplate/core'
import {
  NUTRIENT_LABELS,
  nutrientUnit,
  type NutrientKey,
} from '@pawplate/core'
import { Badge } from '@pawplate/ui/badge'
import { Button } from '@pawplate/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@pawplate/ui/card'
import { Input } from '@pawplate/ui/input'
import { Label } from '@pawplate/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pawplate/ui/select'
import { Skeleton } from '@pawplate/ui/skeleton'
import { AlertTriangle, ArrowLeft, Loader2, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { api } from '../lib/api'

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

// Log meals under the LOCAL date (the server otherwise falls back to UTC —
// same fix applied in the dog-detail and bowl flows).
function localToday(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function FoodDetailsScreen() {
  const { foodId } = useParams<{ foodId: string }>()
  const navigate = useNavigate()
  const [food, setFood] = useState<Food | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [dogs, setDogs] = useState<Dog[]>([])
  const [selectedDogId, setSelectedDogId] = useState<string | undefined>()
  const [mealType, setMealType] = useState<MealType>('breakfast')
  const [grams, setGrams] = useState('100')
  const [isLogging, setIsLogging] = useState(false)

  useEffect(() => {
    if (!foodId) return
    let cancelled = false
    api.foods
      .get(foodId)
      .then(result => {
        if (!cancelled) setFood(result)
      })
      .catch((error: Error) => {
        if (cancelled) return
        if (error.message.toLowerCase().includes('not found')) {
          setNotFound(true)
        } else {
          toast.error(error.message)
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [foodId])

  useEffect(() => {
    let cancelled = false
    api.dogs
      .list()
      .then(userDogs => {
        if (cancelled) return
        setDogs(userDogs)
        setSelectedDogId(userDogs[0]?.id)
      })
      .catch(() => {
        /* dog list is best-effort; the log form just shows the empty state */
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleLogToMeal() {
    if (!selectedDogId || !food) return
    const gramsValue = Number(grams)
    if (!gramsValue || gramsValue <= 0) {
      toast.error('Enter a gram amount greater than 0')
      return
    }
    setIsLogging(true)
    try {
      const result = await api.meals.createForDog(selectedDogId, {
        meal_type: mealType,
        items: [{ ingredient_id: food.id, grams: gramsValue }],
        date: localToday(),
      })
      toast.success(
        `Logged ${gramsValue}g of ${food.name} — ${Math.round(
          result.mealKcal
        )} kcal`
      )
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setIsLogging(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  if (notFound || !food) {
    return (
      <div className="py-12 text-center">
        <h2 className="mb-4 text-xl font-semibold">Food not found</h2>
        <p className="mb-6 text-muted-foreground">
          This food doesn&apos;t exist or has been removed.
        </p>
        <Button asChild>
          <Link to="/foods">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to browse
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            {food.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
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
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="flex items-start gap-2 p-4 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {food.toxicity_note ??
                'This ingredient is flagged as unsafe for dogs.'}
            </span>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {NUTRIENT_GROUPS.map(group => {
          const rows = group.keys
            .map(key => ({ key, value: food[key] as number | null }))
            .filter(row => typeof row.value === 'number' && row.value > 0)

          if (rows.length === 0) return null

          return (
            <Card key={group.title}>
              <CardHeader>
                <CardTitle className="text-base">{group.title}</CardTitle>
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
          <CardTitle className="text-base">Log to a dog&apos;s meal</CardTitle>
        </CardHeader>
        <CardContent>
          {dogs.length === 0 ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Add a dog to start logging meals.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/dogs">Add a dog</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Dog</Label>
                <Select value={selectedDogId} onValueChange={setSelectedDogId}>
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
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label>Meal</Label>
                  <Select
                    value={mealType}
                    onValueChange={v => setMealType(v as MealType)}
                  >
                    <SelectTrigger className="capitalize">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEAL_TYPES.map(type => (
                        <SelectItem
                          key={type}
                          value={type}
                          className="capitalize"
                        >
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24 space-y-1">
                  <Label>Grams</Label>
                  <Input
                    type="number"
                    min="1"
                    value={grams}
                    onChange={e => setGrams(e.target.value)}
                  />
                </div>
              </div>
              <Button
                className="w-full"
                onClick={handleLogToMeal}
                disabled={isLogging}
              >
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
