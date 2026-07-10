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
import { useIngredientSearch } from '@/hooks/use-ingredient-search'
import { createDogMeal } from '@/lib/meal-actions'
import type { BowlAnalysisItem, Food, MealType } from '@/lib/types'
import { cn } from '@/lib/utils'
import { AlertTriangle, Check, Loader2, Plus, Search, Trash2 } from 'lucide-react'
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
}

interface ConfirmRow {
  /** Stable key across edits */
  key: string
  /** What the model said it saw (kept for the eval signal, even if corrected) */
  label: string
  confidence: number
  proportion: number
  ingredient: Food | null
  grams: string
  /**
   * True once the owner has typed in this row's grams. Until then, a grams
   * value is an ESTIMATE derived from the total-weight anchor, and the anchor
   * is free to overwrite it. After it's touched, the anchor leaves it alone.
   */
  gramsTouched: boolean
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

interface BowlConfirmationProps {
  dogId: string
  analysisId: string
  imageUrl: string
  items: AnalyzedBowlItem[]
  notes: string
  onLogged?: () => void
}

export function BowlConfirmation({
  dogId,
  analysisId,
  imageUrl,
  items,
  notes,
  onLogged,
}: BowlConfirmationProps) {
  const [mealType, setMealType] = useState<MealType>('breakfast')
  const [rows, setRows] = useState<ConfirmRow[]>(() =>
    items.map(item => ({
      key: nextKey(),
      label: item.label,
      confidence: item.confidence,
      proportion: item.estimated_proportion,
      ingredient: item.ingredient,
      grams: '',
      gramsTouched: false,
    }))
  )
  // Total weight the owner served. This is the one real measurement the photo
  // can't supply; combined with the model's proportions it prefills per-item
  // grams. Empty until entered — we never assume a weight.
  const [totalGrams, setTotalGrams] = useState('')
  const [isSaving, setIsSaving] = useState(false)

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
        grams: '',
        gramsTouched: false,
      },
    ])

  const unsafe = rows
    .map(row => row.ingredient)
    .filter((f): f is Food => !!f && f.is_safe_for_dogs === false)

  const unmatchedCount = rows.filter(row => !row.ingredient).length

  const handleConfirm = async () => {
    if (rows.length === 0) {
      toast.error('Add at least one ingredient')
      return
    }
    if (unmatchedCount > 0) {
      toast.error('Match every item to an ingredient, or remove it')
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
        { source: 'photo' }
      )

      // Persist what the owner actually confirmed. This is the gold data for
      // vision evals (Phase 6) — best effort, never block the logged meal.
      const correctedItems: BowlAnalysisItem[] = rows.map(row => ({
        ingredient_id: row.ingredient!.id,
        name: row.ingredient!.name,
        proportion: row.proportion,
        confidence: row.confidence,
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
                          // Owner typed it → ground truth. Stop the anchor from
                          // overwriting, and it's no longer an estimate.
                          updateRow(row.key, {
                            grams: e.target.value,
                            gramsTouched: true,
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

                <IngredientPicker
                  placeholder={
                    row.ingredient
                      ? 'Wrong ingredient? Search to replace…'
                      : `Search an ingredient for "${row.label}"…`
                  }
                  onSelect={food => updateRow(row.key, { ingredient: food })}
                />
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
          </div>

          <Button
            onClick={handleConfirm}
            disabled={isSaving || rows.length === 0}
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
