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
import { Textarea } from '@/components/ui/textarea'
import { useIngredientSearch } from '@/hooks/use-ingredient-search'
import { apiClient, ApiError } from '@/lib/api-client'
import {
  acceptBrandedIngredient,
  createManualIngredient,
} from '@/lib/ingredient-actions'
import { createDogMeal } from '@/lib/meal-actions'
import type {
  BrandedSuggestion,
  CanonicalMatch,
} from '@/lib/resolve-ingredient'
import {
  describeVariantChoice,
  per100g,
  type BowlAnalysisItem,
  type Food,
  type MealType,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import {
  AlertTriangle,
  Check,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

/** Below this the model is guessing — nudge the owner to double-check. */
const LOW_CONFIDENCE = 0.6

export interface AnalyzedBowlItem {
  label: string
  estimated_proportion: number
  confidence: number
  normalized_ingredient_id: string | null
  ingredient: Food | null
  /** OFF candidate for an unmatched label — owner must accept it explicitly */
  branded_suggestion?: BrandedSuggestion | null
  /** Photo-derived gram ESTIMATE (bounding box × scale reference × density
   *  priors) — prefills the grams field, always owner-confirmable */
  estimated_grams?: number | null
  /** Canonical group + whether its variants disagree enough to require an
   *  explicit owner choice (e.g. ground beef 70/30 vs 97/3) */
  canonical?: CanonicalMatch | null
}

/** What the photo's gram estimates were scaled against, for the UI notice. */
export type ScaleBasis = 'bowl_diameter' | 'reference_coin' | 'reference_card'

const SCALE_BASIS_LABEL: Record<ScaleBasis, string> = {
  bowl_diameter: "your bowl's measured diameter",
  reference_coin: 'the coin visible in the photo',
  reference_card: 'the card visible in the photo',
}

interface ConfirmRow {
  /** Stable key across edits */
  key: string
  /** What the model said it saw (kept for the eval signal, even if corrected) */
  label: string
  confidence: number
  proportion: number
  ingredient: Food | null
  suggestion: BrandedSuggestion | null
  /** Photo-derived prediction, kept for the §2.4 correction delta */
  estimatedGrams: number | null
  grams: string
  /**
   * True while the owner has a non-empty value typed in this row's grams.
   * Until then, a grams value is an ESTIMATE derived from the total-weight
   * anchor, and the anchor is free to overwrite it. While touched, the anchor
   * leaves it alone; clearing the field back to empty un-sets this so the
   * anchor can re-estimate the row.
   */
  gramsTouched: boolean
  /** Canonical group this row's ingredient belongs to, when it has one */
  canonical: CanonicalMatch | null
  /**
   * True once the owner has explicitly picked a variant (or re-affirmed the
   * pre-filled one). While a row's group `requiresChoice` and this is false,
   * logging is blocked — the pre-filled variant is a guess, not a measurement.
   */
  variantChosen: boolean
}

let rowSeq = 0
const nextKey = () => `row-${rowSeq++}`

/** Inline search box that resolves to one ingredient. */
function IngredientPicker({
  onSelect,
  placeholder,
}: {
  onSelect: (food: Food) => void
  placeholder: string
}) {
  const [query, setQuery] = useState('')
  const { results, isSearching } = useIngredientSearch(query)

  return (
    <div className="relative">
      <div className="relative">
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder}
          className="pr-9"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Search className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>
      {query.length > 1 && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full">
          <Card className="shadow-lg">
            <CardContent className="max-h-52 overflow-y-auto p-2">
              <ul>
                {results.map(food => (
                  <li key={food.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(food)
                        setQuery('')
                      }}
                      className="flex w-full items-center justify-between rounded-md p-2 text-left hover:bg-muted"
                    >
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        {food.name}
                        {food.preparation_state && (
                          <Badge
                            variant="outline"
                            className="px-1.5 py-0 text-xs font-normal text-muted-foreground"
                          >
                            {food.preparation_state}
                          </Badge>
                        )}
                        {(food.source === 'off' ||
                          food.source === 'fatsecret') && (
                          <Badge
                            variant="outline"
                            className="px-1.5 py-0 text-xs font-normal text-muted-foreground"
                          >
                            branded
                          </Badge>
                        )}
                        {food.source === 'manual' && (
                          <Badge
                            variant="outline"
                            className="px-1.5 py-0 text-xs font-normal text-muted-foreground"
                          >
                            custom
                          </Badge>
                        )}
                        {food.is_safe_for_dogs === false && (
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                        )}
                      </span>
                      <Plus className="h-4 w-4 shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

/**
 * Explicit variant choice for an ambiguous canonical group.
 *
 * The vision model reports "ground beef". It cannot see the lean/fat ratio,
 * and neither can anything downstream — yet that ratio moves the group's
 * energy from 121 to 332 kcal/100 g. Previously the top-scoring row's ratio
 * silently became the bowl's nutrition. This makes the owner say which one
 * they actually served.
 *
 * Variants are fetched lazily (on first expand) rather than shipped with every
 * analysis: a group like `beef_round` has 165 members, and most bowl items are
 * never expanded.
 */
function VariantChoice({
  canonical,
  selectedId,
  onChoose,
}: {
  canonical: CanonicalMatch
  selectedId: string | null
  onChoose: (food: Food) => void
}) {
  const [variants, setVariants] = useState<Food[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const open = async () => {
    setIsOpen(true)
    if (variants || isLoading) return
    setIsLoading(true)
    try {
      // Through the shared REST client, never a raw fetch: the route is
      // Bearer-authenticated (lib/server/rest-auth.ts), so a cookie-only
      // request would 401 even for a logged-in owner.
      setVariants(await apiClient.ingredients.variants(canonical.canonicalId))
    } catch (error) {
      console.error('Variant load error:', error)
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
                      className={cn(
                        'flex w-full items-center justify-between gap-2 p-2 text-left text-sm hover:bg-muted',
                        food.id === selectedId && 'bg-muted'
                      )}
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

/**
 * One-tap accept for an Open (Pet) Food Facts candidate. Accepting fetches
 * the canonical product, caches it into `foods` (source='off', ODbL
 * attribution), and resolves this row — future bowls hit the cache locally.
 */
function BrandedSuggestionButton({
  suggestion,
  onAccepted,
}: {
  suggestion: BrandedSuggestion
  onAccepted: (food: Food) => void
}) {
  const [isAccepting, setIsAccepting] = useState(false)

  const accept = async () => {
    setIsAccepting(true)
    try {
      const food = await acceptBrandedIngredient(suggestion.code)
      onAccepted(food)
      toast.success(`Matched "${food.name}" (branded)`)
    } catch (error) {
      console.error('Accept branded suggestion error:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to add product'
      )
    } finally {
      setIsAccepting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={accept}
      disabled={isAccepting}
      className="flex w-full items-center justify-between rounded-md border border-dashed p-2 text-left text-sm hover:bg-muted"
    >
      <span>
        Looks like:{' '}
        <span className="font-medium">
          {suggestion.brand ? `${suggestion.brand} ` : ''}
          {suggestion.name}
        </span>{' '}
        <span className="text-muted-foreground">— branded, limited data</span>
      </span>
      {isAccepting ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      ) : (
        <Plus className="h-4 w-4 shrink-0" />
      )}
    </button>
  )
}

/**
 * Inline form for the terminal fallback: nothing in the database matches, so
 * the owner logs the item with an estimated per-100g calorie value (macros
 * optional). Creates a source='manual' sparse row — the item then counts
 * toward the meal total instead of being deleted and silently under-counting.
 */
function CustomEntryForm({
  label,
  onCreated,
}: {
  label: string
  onCreated: (food: Food) => void
}) {
  const [name, setName] = useState(label)
  const [kcal, setKcal] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const submit = async () => {
    if (!name.trim() || !Number.isFinite(Number(kcal)) || kcal === '') {
      toast.error('Enter a name and estimated calories per 100 g')
      return
    }
    setIsSaving(true)
    try {
      const food = await createManualIngredient({
        name: name.trim(),
        calories_per_100g: Number(kcal),
      })
      onCreated(food)
      toast.success(`Added "${food.name}" as a custom ingredient`)
    } catch (error) {
      console.error('Create manual ingredient error:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to add ingredient'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 p-2">
      <Input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Ingredient name"
        className="h-8 w-44 text-sm"
        aria-label="Custom ingredient name"
      />
      <Input
        type="number"
        min="0"
        value={kcal}
        onChange={e => setKcal(e.target.value)}
        placeholder="est. kcal / 100g"
        className="h-8 w-32 text-sm"
        aria-label="Estimated calories per 100 grams"
      />
      <Button size="sm" variant="secondary" onClick={submit} disabled={isSaving}>
        {isSaving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          'Log as custom'
        )}
      </Button>
      <p className="w-full text-xs text-muted-foreground">
        Estimate only — counted in calories, excluded from nutrient analysis.
      </p>
    </div>
  )
}

interface BowlConfirmationProps {
  dogId: string
  analysisId: string
  imageUrl: string
  items: AnalyzedBowlItem[]
  notes: string
  /** Set when the photo had a usable scale reference — enables the
   *  gram-estimate prefill notice */
  scaleBasis?: ScaleBasis | null
  onLogged?: () => void
  /**
   * Re-run the vision model on the already-uploaded photo with a corrective
   * note (e.g. "there's also ground beef in there"). The parent owns the
   * fetch and remounts this component with the fresh items on success.
   */
  onReanalyze?: (note: string) => Promise<void>
}

export function BowlConfirmation({
  dogId,
  analysisId,
  imageUrl,
  items,
  notes,
  scaleBasis,
  onLogged,
  onReanalyze,
}: BowlConfirmationProps) {
  const [mealType, setMealType] = useState<MealType>('breakfast')
  const [rows, setRows] = useState<ConfirmRow[]>(() =>
    items.map(item => ({
      key: nextKey(),
      label: item.label,
      confidence: item.confidence,
      proportion: item.estimated_proportion,
      ingredient: item.ingredient,
      suggestion: item.branded_suggestion ?? null,
      estimatedGrams: item.estimated_grams ?? null,
      // Photo-derived estimates prefill the field but stay in the untouched
      // "estimate" state (amber) — the owner confirms or overwrites them,
      // and the total-weight anchor below is still free to replace them.
      grams: item.estimated_grams != null ? String(item.estimated_grams) : '',
      gramsTouched: false,
      canonical: item.canonical ?? null,
      // Never pre-satisfied. When the group is ambiguous the owner must pick,
      // even if they end up picking the pre-filled variant — that click is the
      // difference between a measurement and an assumption.
      variantChosen: false,
    }))
  )
  // Total weight the owner served. This is the one real measurement the photo
  // can't supply; combined with the model's proportions it prefills per-item
  // grams. Empty until entered — we never assume a weight.
  const [totalGrams, setTotalGrams] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [reanalyzeNote, setReanalyzeNote] = useState('')
  const [isReanalyzing, setIsReanalyzing] = useState(false)

  const handleReanalyze = async () => {
    if (!onReanalyze) return
    const note = reanalyzeNote.trim()
    if (!note) {
      toast.error('Describe what the analysis missed or got wrong')
      return
    }
    setIsReanalyzing(true)
    try {
      // On success the parent remounts this component with the new result,
      // so there is no local state to reconcile here.
      await onReanalyze(note)
      toast.success('Re-analyzed with your note')
    } catch (error) {
      console.error('Re-analyze bowl error:', error)
      toast.error(
        error instanceof Error ? error.message : 'Re-analysis failed'
      )
      setIsReanalyzing(false)
    }
  }

  const updateRow = (key: string, patch: Partial<ConfirmRow>) =>
    setRows(prev =>
      prev.map(row => (row.key === key ? { ...row, ...patch } : row))
    )

  /**
   * Distribute a total weight across rows by each item's proportion, but only
   * fill rows the owner hasn't already typed into — a manual entry is ground
   * truth and the anchor must not clobber it. An invalid/blank total clears the
   * untouched estimates rather than leaving stale numbers behind.
   */
  const applyTotalWeight = (value: string) => {
    setTotalGrams(value)
    const total = Number(value)
    const valid = Number.isFinite(total) && total > 0
    setRows(prev =>
      prev.map(row =>
        row.gramsTouched
          ? row
          : {
              ...row,
              grams:
                valid && row.proportion > 0
                  ? String(Math.round(total * row.proportion))
                  : '',
            }
      )
    )
  }

  const removeRow = (key: string) =>
    setRows(prev => prev.filter(row => row.key !== key))

  const addRow = (food: Food) =>
    setRows(prev => [
      ...prev,
      {
        key: nextKey(),
        // Owner-added: no model label, so record the ingredient name and
        // zero confidence — the eval signal needs to see what we missed.
        label: food.name,
        confidence: 0,
        // No visual proportion for a hand-added item, so the anchor can't
        // estimate it — the owner enters its grams directly.
        proportion: 0,
        ingredient: food,
        suggestion: null,
        estimatedGrams: null,
        grams: '',
        gramsTouched: false,
        // Hand-picked from search: the owner already chose this exact row, so
        // there is nothing left to disambiguate.
        canonical: null,
        variantChosen: true,
      },
    ])

  const unsafe = rows
    .map(row => row.ingredient)
    .filter((f): f is Food => !!f && f.is_safe_for_dogs === false)

  const unmatchedCount = rows.filter(row => !row.ingredient).length

  /** Rows whose canonical group is ambiguous and still unconfirmed. */
  const pendingVariantRows = rows.filter(
    row => row.canonical?.requiresChoice && !row.variantChosen
  )

  const handleConfirm = async () => {
    if (rows.length === 0) {
      toast.error('Add at least one ingredient')
      return
    }
    if (unmatchedCount > 0) {
      toast.error(
        'Resolve every item: search an ingredient, accept a suggested product, or log it as custom'
      )
      return
    }
    if (pendingVariantRows.length > 0) {
      toast.error(
        `Pick which ${pendingVariantRows
          .map(row => row.canonical?.displayName.toLowerCase())
          .join(' and ')} you used — the photo can't tell us`
      )
      return
    }
    if (rows.some(row => !Number(row.grams) || Number(row.grams) <= 0)) {
      toast.error('Enter a gram amount greater than 0 for every ingredient')
      return
    }

    setIsSaving(true)
    try {
      const result = await createDogMeal(
        dogId,
        mealType,
        rows.map(row => ({
          ingredient_id: row.ingredient!.id,
          grams: Number(row.grams),
        })),
        // Log under the owner's local calendar day. Without this the service
        // falls back to the UTC date, so a meal photographed in the evening
        // (US timezones) lands on tomorrow and vanishes from today's dashboard.
        { source: 'photo', date: format(new Date(), 'yyyy-MM-dd') }
      )

      // Persist what the owner actually confirmed. This is the gold data for
      // vision evals (Phase 6) — best effort, never block the logged meal.
      // grams vs estimated_grams is the §2.4 calibration signal: consistent
      // deltas per food category mean the density/height priors need tuning.
      const correctedItems: BowlAnalysisItem[] = rows.map(row => ({
        ingredient_id: row.ingredient!.id,
        name: row.ingredient!.name,
        proportion: row.proportion,
        confidence: row.confidence,
        grams: Number(row.grams),
        estimated_grams: row.estimatedGrams,
      }))
      try {
        await fetch('/api/bowl/analyze', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            analysis_id: analysisId,
            corrected_items: correctedItems,
          }),
        })
      } catch (error) {
        console.error('Failed to save bowl corrections:', error)
      }

      toast.success(
        `Logged ${mealType} from photo — ${Math.round(result.mealKcal)} kcal`
      )
      onLogged?.()
    } catch (error) {
      console.error('Confirm bowl error:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to log meal'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {unsafe.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unsafe ingredient detected</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc pl-4">
              {unsafe.map(food => (
                <li key={food.id}>
                  <span className="font-medium">{food.name}</span>
                  {food.toxicity_note ? ` — ${food.toxicity_note}` : ''}
                </li>
              ))}
            </ul>
            <p className="mt-2">
              Contact your veterinarian or the ASPCA Animal Poison Control
              Center if your dog ate these.
            </p>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Confirm this bowl</CardTitle>
            <Select
              value={mealType}
              onValueChange={v => setMealType(v as MealType)}
            >
              <SelectTrigger className="w-32 capitalize">
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
        </CardHeader>
        <CardContent className="space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="The bowl you photographed"
            className="max-h-64 w-full rounded-lg border object-cover"
          />

          <p className="text-sm text-muted-foreground">
            Percentages are the model&apos;s rough visual estimate of the bowl,
            not weights.
          </p>

          {scaleBasis && (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Gram amounts below were pre-estimated using{' '}
              {SCALE_BASIS_LABEL[scaleBasis]} as a size reference. They&apos;re
              starting points, not measurements — confirm or adjust each one.
            </p>
          )}

          {notes && (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              {notes}
            </p>
          )}

          <div className="space-y-1.5 rounded-md border bg-muted/40 p-3">
            <label
              htmlFor="total-served-weight"
              className="text-sm font-medium"
            >
              Total served weight (optional)
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="total-served-weight"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={totalGrams}
                onChange={e => applyTotalWeight(e.target.value)}
                className="w-32"
                placeholder="e.g. 250"
              />
              <span className="text-sm text-muted-foreground">
                grams total
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Weigh the bowl once and enter it here — we&apos;ll split it across
              the items by the model&apos;s proportions as a starting estimate.
              Adjust any row and it stays put. The model can&apos;t weigh food
              from a photo, so these are estimates until you confirm them.
            </p>
          </div>

          <ul className="space-y-3" data-testid="bowl-items">
            {rows.map(row => {
              // A grams value that came from the anchor and hasn't been edited:
              // usable, but flagged so the owner knows it's a guess to confirm.
              const isEstimate = !row.gramsTouched && row.grams !== ''
              return (
              <li key={row.key} className="space-y-2 rounded-md border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {/* Not a <p>: Badge renders a <div>, which is invalid inside
                        a paragraph. This is a flex row, so <div> is right anyway. */}
                    <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                      {row.ingredient ? (
                        <>
                          <Check className="h-4 w-4 text-primary" />
                          {row.ingredient.name}
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          <span className="italic">
                            &ldquo;{row.label}&rdquo; — no match
                          </span>
                        </>
                      )}
                      {row.proportion > 0 && (
                        <Badge variant="secondary" className="font-normal">
                          ~{Math.round(row.proportion * 100)}% of bowl
                        </Badge>
                      )}
                      {row.confidence > 0 && (
                        <Badge
                          variant="outline"
                          className={cn(
                            'border-0 font-normal',
                            row.confidence < LOW_CONFIDENCE
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {Math.round(row.confidence * 100)}% confident
                        </Badge>
                      )}
                    </div>
                    {row.ingredient && row.label !== row.ingredient.name && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Model saw &ldquo;{row.label}&rdquo;
                      </p>
                    )}
                    {row.ingredient?.is_safe_for_dogs === false && (
                      <p className="mt-0.5 text-xs text-destructive">
                        Unsafe for dogs
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="flex flex-col items-end gap-0.5">
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={row.grams}
                        onChange={e =>
                          // A non-empty value the owner typed is ground truth —
                          // stop the anchor overwriting it. Clearing it back to
                          // empty returns the row to the anchor, so it can be
                          // re-estimated on the next total-weight change.
                          updateRow(row.key, {
                            grams: e.target.value,
                            gramsTouched: e.target.value !== '',
                          })
                        }
                        className={cn(
                          'w-20 text-right',
                          isEstimate &&
                            'border-amber-500/50 text-amber-600 dark:text-amber-400'
                        )}
                        placeholder="g"
                        aria-label={`Grams of ${row.ingredient?.name ?? row.label}`}
                      />
                      {isEstimate && (
                        <span className="text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                          estimate
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">g</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(row.key)}
                      aria-label={`Remove ${row.ingredient?.name ?? row.label}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {row.canonical?.requiresChoice && (
                  <VariantChoice
                    canonical={row.canonical}
                    selectedId={row.variantChosen ? row.ingredient?.id ?? null : null}
                    onChoose={food =>
                      updateRow(row.key, {
                        ingredient: food,
                        variantChosen: true,
                      })
                    }
                  />
                )}

                <IngredientPicker
                  placeholder={
                    row.ingredient
                      ? 'Wrong ingredient? Search to replace…'
                      : `Search an ingredient for "${row.label}"…`
                  }
                  onSelect={food =>
                    // An explicit search pick supersedes the group gate: the
                    // owner named the exact row they want.
                    updateRow(row.key, { ingredient: food, variantChosen: true })
                  }
                />

                {!row.ingredient && row.suggestion && (
                  <BrandedSuggestionButton
                    suggestion={row.suggestion}
                    onAccepted={food =>
                      updateRow(row.key, { ingredient: food })
                    }
                  />
                )}
                {!row.ingredient && (
                  <CustomEntryForm
                    label={row.label}
                    onCreated={food => updateRow(row.key, { ingredient: food })}
                  />
                )}
              </li>
              )
            })}
          </ul>

          <div className="space-y-2 rounded-md border border-dashed p-3">
            <p className="text-sm font-medium">Missed something?</p>
            <IngredientPicker
              placeholder="Add another ingredient…"
              onSelect={addRow}
            />
            {onReanalyze && (
              <div className="space-y-2 border-t pt-2">
                <p className="text-xs text-muted-foreground">
                  Or tell the model what it missed and re-analyze the same
                  photo — good for mixed-in or broth-covered foods it
                  can&apos;t see.
                </p>
                <Textarea
                  value={reanalyzeNote}
                  onChange={e => setReanalyzeNote(e.target.value)}
                  maxLength={500}
                  rows={2}
                  disabled={isReanalyzing}
                  placeholder='e.g. "there&apos;s also ground beef and shredded chicken mixed in"'
                  aria-label="Note for re-analysis"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleReanalyze}
                  disabled={isReanalyzing || !reanalyzeNote.trim()}
                >
                  {isReanalyzing ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Re-analyzing…
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-3.5 w-3.5" />
                      Re-analyze with this note
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Re-analyzing replaces the item list above — grams you&apos;ve
                  entered here will reset.
                </p>
              </div>
            )}
          </div>

          {pendingVariantRows.length > 0 && (
            <p className="text-center text-xs text-amber-600 dark:text-amber-400">
              Pick an option for{' '}
              {pendingVariantRows
                .map(row => row.canonical?.displayName.toLowerCase())
                .join(', ')}{' '}
              before logging.
            </p>
          )}

          <Button
            onClick={handleConfirm}
            disabled={
              isSaving || rows.length === 0 || pendingVariantRows.length > 0
            }
            className="w-full"
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Log {mealType} from photo
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
