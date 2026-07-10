'use client'

import type { AnalyzedBowlItem } from '@/components/bowl-confirmation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Food } from '@/lib/types'
import { cn } from '@/lib/utils'
import { AlertTriangle, Camera, Check, Lock } from 'lucide-react'
import Link from 'next/link'

/** Below this the model is guessing — say so rather than imply precision. */
const LOW_CONFIDENCE = 0.6

interface GuestBowlResultProps {
  items: AnalyzedBowlItem[]
  notes: string
  /** Object URL of the local file — guest photos are never uploaded. */
  previewUrl: string | null
  onScanAnother: () => void
}

/**
 * Read-only view of a guest bowl scan.
 *
 * A guest has no dog, so there are no AAFCO targets to compare against and no
 * gap analysis to show — identification and the safety check are the whole
 * result. Nothing here writes: no grams input, no meal, no corrections. The
 * correction UI lives in BowlConfirmation, behind auth, because a correction is
 * only worth persisting when it's attributable eval data.
 */
export function GuestBowlResult({
  items,
  notes,
  previewUrl,
  onScanAnother,
}: GuestBowlResultProps) {
  const unsafe = items
    .map(item => item.ingredient)
    .filter((f): f is Food => !!f && f.is_safe_for_dogs === false)

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
          <CardTitle className="text-lg">What we found in this bowl</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="The bowl you photographed"
              className="max-h-64 w-full rounded-lg border object-cover"
            />
          )}

          <p className="text-sm text-muted-foreground">
            Percentages are the model&apos;s rough visual estimate of the bowl,
            not weights. Nutrient math is never done by the model.
          </p>

          {notes && (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              {notes}
            </p>
          )}

          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No ingredients were identified. Try a photo shot from above, one
              bowl per frame, in good light.
            </p>
          ) : (
            <ul className="space-y-2" data-testid="guest-bowl-items">
              {items.map((item, index) => (
                <li
                  key={`${item.label}-${index}`}
                  className="rounded-md border p-3"
                >
                  {/* Not a <p>: Badge renders a <div>, which is invalid inside
                      a paragraph. This is a flex row, so <div> is right anyway. */}
                  <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                    {item.ingredient ? (
                      <>
                        <Check className="h-4 w-4 text-primary" />
                        {item.ingredient.name}
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span className="italic">
                          &ldquo;{item.label}&rdquo; — no match in our database
                        </span>
                      </>
                    )}
                    {item.estimated_proportion > 0 && (
                      <Badge variant="secondary" className="font-normal">
                        ~{Math.round(item.estimated_proportion * 100)}% of bowl
                      </Badge>
                    )}
                    {item.confidence > 0 && (
                      <Badge
                        variant="outline"
                        className={cn(
                          'border-0 font-normal',
                          item.confidence < LOW_CONFIDENCE
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {Math.round(item.confidence * 100)}% confident
                      </Badge>
                    )}
                  </div>
                  {item.ingredient && item.label !== item.ingredient.name && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Model saw &ldquo;{item.label}&rdquo;
                    </p>
                  )}
                  {item.ingredient?.is_safe_for_dogs === false && (
                    <p className="mt-0.5 text-xs text-destructive">
                      Unsafe for dogs
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          <Button variant="outline" className="w-full" onClick={onScanAnother}>
            <Camera className="mr-2 h-4 w-4" />
            Scan another bowl
          </Button>
        </CardContent>
      </Card>

      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="space-y-3 p-5">
          <p className="flex items-center gap-2 font-semibold">
            <Lock className="h-4 w-4" />
            Want to know if this bowl is balanced?
          </p>
          <p className="text-sm text-muted-foreground">
            Guests get identification and the safety check. Add your dog&apos;s
            weight and life stage to see a per-nutrient gap analysis against
            AAFCO targets, log the meal, and track it over time.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/auth/sign-up">Create a free account</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/auth/login">Sign in</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
