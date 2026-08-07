import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Capacitor } from '@capacitor/core'
import type {
  AnalyzedBowlItem,
  BowlAnalyzeResult,
  ScaleBasis,
} from '@pawplate/api-client'
import {
  computeMealNutrients,
  describeVariantChoice,
  findUnsafeIngredients,
  per100g,
  type BowlAnalysisItem,
  type CanonicalMatch,
  type Ingredient,
  type MealType,
} from '@pawplate/core'
import { Alert, AlertDescription, AlertTitle } from '@pawplate/ui/alert'
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
import { Textarea } from '@pawplate/ui/textarea'
import {
  AlertTriangle,
  ArrowLeft,
  Camera as CameraIcon,
  Check,
  Loader2,
  Search,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { api, ApiError } from '../lib/api'

const MEAL_TYPES: Array<{ value: MealType; label: string }> = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
]

/** Local calendar day as YYYY-MM-DD (the service defaults to UTC otherwise,
 *  dropping evening meals onto tomorrow's dashboard). */
function localToday(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

const SCALE_BASIS_LABEL: Record<ScaleBasis, string> = {
  bowl_diameter: "your bowl's measured diameter",
  reference_coin: 'the coin in the photo',
  reference_card: 'the card in the photo',
}

/** One confirmation row — an identified item the owner is confirming. */
interface Row {
  key: string
  label: string
  proportion: number
  confidence: number
  /** Matched/resolved ingredient, or null while unmatched. */
  ingredient: Ingredient | null
  brandedCode: string | null
  grams: string
  estimatedGrams: number | null
  /** Canonical group this row's ingredient belongs to, when it has one */
  canonical: CanonicalMatch | null
  /**
   * True once the owner has explicitly picked a variant (or re-affirmed the
   * pre-filled one). While a row's group `requiresChoice` and this is false,
   * logging is blocked — the pre-filled variant is a guess, not a measurement.
   * Mirrors apps/web/components/bowl-confirmation.tsx.
   */
  variantChosen: boolean
}

function toRow(item: AnalyzedBowlItem, index: number): Row {
  return {
    key: `${index}-${item.label}`,
    label: item.label,
    proportion: item.estimated_proportion,
    confidence: item.confidence,
    ingredient: item.ingredient,
    brandedCode: item.branded_suggestion?.code ?? null,
    grams: item.estimated_grams != null ? String(item.estimated_grams) : '',
    estimatedGrams: item.estimated_grams ?? null,
    canonical: item.canonical ?? null,
    // Never pre-satisfied — when the group is ambiguous the owner must pick,
    // even if they end up picking the pre-filled variant.
    variantChosen: false,
  }
}

/**
 * Explicit variant choice for an ambiguous canonical group — the mobile
 * counterpart of web's VariantChoice. The vision model reports "ground beef"
 * but cannot see the lean/fat ratio, which moves the group's energy 121-332
 * kcal/100 g; logging is blocked until the owner says which one they served.
 * Variants load lazily through the shared REST client on first expand.
 */
function VariantChoice({
  canonical,
  selectedId,
  onChoose,
}: {
  canonical: CanonicalMatch
  selectedId: string | null
  onChoose: (food: Ingredient) => void
}) {
  const [variants, setVariants] = useState<Ingredient[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  async function open() {
    setIsOpen(true)
    if (variants || isLoading) return
    setIsLoading(true)
    try {
      setVariants(await api.ingredients.variants(canonical.canonicalId))
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'Could not load options'
      )
      setIsOpen(false)
    } finally {
      setIsLoading(false)
    }
  }


  return (
    <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Which {canonical.displayName.toLowerCase()} did you use?
            </p>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
              {describeVariantChoice(canonical)}
            </p>
          </div>

          {!isOpen ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={open}
              data-testid="variant-choice-open"
            >
              Choose an option
            </Button>
          ) : isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading options…
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto rounded-md border bg-background">
              <ul className="divide-y">
                {(variants ?? []).map(food => (
                  <li key={food.id}>
                    <button
                      type="button"
                      onClick={() => onChoose(food)}
                      className={`flex w-full items-center justify-between gap-2 p-2 text-left text-sm hover:bg-muted${
                        food.id === selectedId ? ' bg-muted' : ''
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{food.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {/* Normalized — never assume serving_size is 100 g */}
                          {Math.round(
                            per100g(food.calories_per_serving, food.serving_size) ?? 0
                          )}{' '}
                          kcal
                          {food.fat_g != null &&
                            ` · ${(per100g(food.fat_g, food.serving_size) ?? 0).toFixed(1)}g fat`}
                          {food.preparation_state && ` · ${food.preparation_state}`}
                          {' / 100g'}
                        </span>
                      </span>
                      {food.id === selectedId && (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Grab a photo: native camera/library prompt, or a file input on web dev. */
async function capturePhotoNative(): Promise<Blob | null> {
  const photo = await Camera.getPhoto({
    quality: 80,
    resultType: CameraResultType.Uri,
    source: CameraSource.Prompt,
  })
  if (!photo.webPath) return null
  return await fetch(photo.webPath).then(r => r.blob())
}

/** Debounced ingredient search (mirrors MealFormScreen). */
function useIngredientSearch(query: string) {
  const [results, setResults] = useState<Ingredient[]>([])
  const [isSearching, setIsSearching] = useState(false)
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setIsSearching(false)
      return
    }
    let cancelled = false
    const timeout = setTimeout(async () => {
      setIsSearching(true)
      try {
        const foods = await api.ingredients.search(query)
        if (!cancelled) setResults(foods)
      } catch {
        if (!cancelled) toast.error('Ingredient search failed')
      } finally {
        if (!cancelled) setIsSearching(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [query])
  return { results, isSearching }
}

export function BowlPhotoScreen() {
  const { dogId = '' } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [hint, setHint] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<BowlAnalyzeResult | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const [mealType, setMealType] = useState<MealType>('breakfast')
  const [rows, setRows] = useState<Row[]>([])
  const [submitting, setSubmitting] = useState(false)
  // Which row (by key) is currently running an inline ingredient search.
  const [searchingRow, setSearchingRow] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const { results, isSearching } = useIngredientSearch(query)

  const backTo = `/dogs/${dogId}`

  async function analyzeBlob(blob: Blob) {
    setIsAnalyzing(true)
    setPreviewUrl(URL.createObjectURL(blob))
    try {
      const result = await api.bowl.analyze({ image: blob, dogId, hint })
      setAnalysis(result)
      setRows(result.items.map(toRow))
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Bowl analysis failed'
      toast.error(message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  async function handleCapture() {
    if (Capacitor.getPlatform() === 'web') {
      fileInputRef.current?.click()
      return
    }
    try {
      const blob = await capturePhotoNative()
      if (blob) await analyzeBlob(blob)
    } catch {
      // User cancelled the native prompt, or permission denied.
      toast.error('Could not open the camera')
    }
  }

  function onFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) void analyzeBlob(file)
    event.target.value = ''
  }

  const numericItems = useMemo(
    () =>
      rows
        .filter(r => r.ingredient)
        .map(r => ({ ingredient: r.ingredient!, grams: Number(r.grams) || 0 })),
    [rows]
  )
  const previewKcal = useMemo(
    () => computeMealNutrients(numericItems).totals.calories,
    [numericItems]
  )
  const unsafe = useMemo(
    () => findUnsafeIngredients(numericItems),
    [numericItems]
  )
  const unmatchedCount = rows.filter(r => !r.ingredient).length
  /** Rows whose canonical group is ambiguous and still unconfirmed. */
  const pendingVariantRows = rows.filter(
    r => r.canonical?.requiresChoice && !r.variantChosen
  )

  function setGrams(key: string, grams: string) {
    setRows(current =>
      current.map(r => (r.key === key ? { ...r, grams } : r))
    )
  }

  function removeRow(key: string) {
    setRows(current => current.filter(r => r.key !== key))
    if (searchingRow === key) setSearchingRow(null)
  }

  function assignIngredient(key: string, ingredient: Ingredient) {
    setRows(current =>
      current.map(r =>
        r.key === key
          ? {
              ...r,
              ingredient,
              grams: r.grams || '100',
              brandedCode: null,
              // An explicit pick (variant choice or search) supersedes the
              // group gate: the owner named the exact row they want.
              variantChosen: true,
            }
          : r
      )
    )
    setSearchingRow(null)
    setQuery('')
  }

  async function acceptBranded(key: string, code: string) {
    try {
      const food = await api.ingredients.acceptBranded(code)
      assignIngredient(key, food)
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'Could not add that product'
      )
    }
  }

  async function handleSubmit() {
    if (unmatchedCount > 0) {
      toast.error('Resolve every item: search an ingredient or remove it')
      return
    }
    if (pendingVariantRows.length > 0) {
      toast.error(
        `Pick which ${pendingVariantRows
          .map(r => r.canonical?.displayName.toLowerCase())
          .join(' and ')} you used — the photo can't tell us`
      )
      return
    }
    if (rows.some(r => !(Number(r.grams) > 0))) {
      toast.error('Enter a gram amount greater than 0 for every ingredient')
      return
    }

    setSubmitting(true)
    try {
      const result = await api.meals.createForDog(dogId, {
        meal_type: mealType,
        items: rows.map(r => ({
          ingredient_id: r.ingredient!.id,
          grams: Number(r.grams),
        })),
        source: 'photo',
        date: localToday(),
      })

      // Persist the owner's confirmed grams next to our estimate — the §2.4
      // calibration signal. Best effort; never block the logged meal.
      if (analysis?.analysis_id) {
        const correctedItems: BowlAnalysisItem[] = rows.map(r => ({
          ingredient_id: r.ingredient!.id,
          name: r.ingredient!.name,
          proportion: r.proportion,
          confidence: r.confidence,
          grams: Number(r.grams),
          estimated_grams: r.estimatedGrams,
        }))
        try {
          await api.bowl.saveCorrections({
            analysisId: analysis.analysis_id,
            correctedItems,
          })
        } catch {
          // Non-fatal — the meal is already logged.
        }
      }

      if (result.unsafeIngredients.length > 0) {
        toast.warning(
          `Unsafe for dogs: ${result.unsafeIngredients
            .map(i => i.name)
            .join(', ')}${result.requiresVetNotice ? ' — contact your vet.' : ''}`
        )
      }
      toast.success(
        `Logged ${mealType} from photo — ${Math.round(result.mealKcal)} kcal`
      )
      navigate(backTo)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to log meal')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        data-testid="bowl-photo-input"
        onChange={onFilePicked}
      />

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild aria-label="Back">
          <Link to={backTo}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Log from photo</h1>
      </div>

      {!analysis ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Photograph the bowl top-down. Set the bowl diameter on your dog once
            for the best portion estimates, or lay a card or quarter flat in the
            frame as a size reference.
          </p>

          <div className="space-y-2">
            <Label htmlFor="bowl-hint">Note for the model (optional)</Label>
            <Textarea
              id="bowl-hint"
              placeholder="e.g. the protein is chicken breast"
              value={hint}
              onChange={e => setHint(e.target.value)}
            />
          </div>

          {previewUrl && (
            <img
              src={previewUrl}
              alt="Bowl preview"
              className="max-h-64 w-full rounded-md object-cover"
            />
          )}

          <Button
            className="w-full"
            onClick={handleCapture}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CameraIcon className="mr-2 h-4 w-4" />
            )}
            {isAnalyzing ? 'Analyzing…' : 'Take or choose a photo'}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Confirm this bowl</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAnalysis(null)
                setRows([])
                setPreviewUrl(null)
              }}
            >
              Retake
            </Button>
          </div>

          {analysis.scale_basis && (
            <p className="text-xs text-muted-foreground">
              Grams are pre-estimated using {SCALE_BASIS_LABEL[analysis.scale_basis]}
              . Every amount is an estimate — adjust to what you actually served.
            </p>
          )}

          {analysis.notes && (
            <Alert>
              <AlertTitle>Model note</AlertTitle>
              <AlertDescription>{analysis.notes}</AlertDescription>
            </Alert>
          )}

          {unsafe.length > 0 && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Unsafe for dogs:{' '}
                {unsafe
                  .map(i =>
                    i.toxicity_note ? `${i.name} (${i.toxicity_note})` : i.name
                  )
                  .join(', ')}
              </p>
            </div>
          )}

          <ul className="space-y-2" data-testid="bowl-items">
            {rows.map(row => (
              <li key={row.key}>
                <Card>
                  <CardContent className="space-y-2 py-3">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium capitalize">
                          {row.ingredient?.name ?? row.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ~{Math.round(row.proportion * 100)}% of bowl ·{' '}
                          {Math.round(row.confidence * 100)}% confident
                        </p>
                      </div>
                      {row.ingredient ? (
                        <>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="1"
                            className="w-20 text-right"
                            aria-label={`Grams of ${row.ingredient.name}`}
                            value={row.grams}
                            onChange={e => setGrams(row.key, e.target.value)}
                          />
                          <span className="text-sm text-muted-foreground">
                            g
                          </span>
                        </>
                      ) : (
                        <Badge variant="outline">no match</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${row.label}`}
                        onClick={() => removeRow(row.key)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {row.ingredient && row.estimatedGrams != null && (
                      <p className="text-xs text-muted-foreground">estimate</p>
                    )}

                    {row.canonical?.requiresChoice && (
                      <VariantChoice
                        canonical={row.canonical}
                        selectedId={
                          row.variantChosen ? (row.ingredient?.id ?? null) : null
                        }
                        onChoose={food => assignIngredient(row.key, food)}
                      />
                    )}

                    {!row.ingredient && (
                      <div className="space-y-2">
                        {row.brandedCode && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() =>
                              acceptBranded(row.key, row.brandedCode!)
                            }
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Use suggested product
                          </Button>
                        )}
                        {searchingRow === row.key ? (
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              autoFocus
                              className="pl-9"
                              placeholder="Search an ingredient…"
                              value={query}
                              onChange={e => setQuery(e.target.value)}
                            />
                            {isSearching && (
                              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                            )}
                            {results.length > 0 && (
                              <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
                                {results.map(food => (
                                  <button
                                    key={food.id}
                                    type="button"
                                    className="flex w-full items-baseline justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                                    onClick={() =>
                                      assignIngredient(row.key, food)
                                    }
                                  >
                                    <span>{food.name}</span>
                                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                                      {Math.round(food.calories_per_serving)} kcal
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              setSearchingRow(row.key)
                              setQuery('')
                            }}
                          >
                            <Search className="mr-2 h-4 w-4" />
                            Find a match
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>

          <div className="grid grid-cols-2 items-end gap-4">
            <div className="space-y-2">
              <Label>Meal</Label>
              <Select
                value={mealType}
                onValueChange={value => setMealType(value as MealType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-right text-sm text-muted-foreground">
              ~{Math.round(previewKcal)} kcal
            </p>
          </div>

          {pendingVariantRows.length > 0 && (
            <p className="text-center text-xs text-amber-600 dark:text-amber-400">
              Pick an option for{' '}
              {pendingVariantRows
                .map(r => r.canonical?.displayName.toLowerCase())
                .join(', ')}{' '}
              before logging.
            </p>
          )}

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={
              submitting || rows.length === 0 || pendingVariantRows.length > 0
            }
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Log {mealType} from photo
          </Button>
        </div>
      )}
    </div>
  )
}
