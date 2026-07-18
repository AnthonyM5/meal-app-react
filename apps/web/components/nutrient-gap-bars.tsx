'use client'

import { Badge } from '@/components/ui/badge'
import {
  NUTRIENT_LABELS,
  type GapStatus,
  type NutrientGap,
  type NutrientKey,
} from '@/lib/canine-nutrition'
import { cn } from '@/lib/utils'

export { NUTRIENT_LABELS }

const STATUS_STYLES: Record<
  GapStatus,
  { bar: string; badge: string; label: string }
> = {
  deficient: {
    bar: 'bg-orange-500',
    badge: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
    label: 'Low',
  },
  adequate: {
    bar: 'bg-emerald-500',
    badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    label: 'On target',
  },
  excess: {
    bar: 'bg-amber-500',
    badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    label: 'High',
  },
  toxic_risk: {
    bar: 'bg-red-600',
    badge: 'bg-red-600/15 text-red-600 dark:text-red-400',
    label: 'Over safe limit',
  },
  informational: {
    bar: 'bg-sky-500',
    badge: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
    label: 'Info only',
  },
  // Every contributor for this nutrient was excluded (branded item, or the
  // source didn't report it). Deliberately colorless: "we don't know" must not
  // look like a health verdict in either direction.
  unmeasured: {
    bar: 'bg-muted-foreground/30',
    badge: 'bg-muted text-muted-foreground',
    label: 'Not measured',
  },
}

function formatAmount(value: number, unit: string) {
  const rounded =
    value >= 100 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${unit}`
}

interface NutrientGapBarsProps {
  gaps: Partial<Record<NutrientKey, NutrientGap>>
}

export function NutrientGapBars({ gaps }: NutrientGapBarsProps) {
  const entries = Object.values(gaps)
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Log a meal to see nutrient coverage.
      </p>
    )
  }

  // Problems first: toxic_risk, then deficient. `unmeasured` sits high because
  // an unknown could be a deficiency — it deserves attention, not burial.
  const order: GapStatus[] = [
    'toxic_risk',
    'deficient',
    'unmeasured',
    'excess',
    'adequate',
    'informational',
  ]
  const sorted = [...entries].sort(
    (a, b) => order.indexOf(a.status) - order.indexOf(b.status)
  )

  return (
    <ul className="space-y-3">
      {sorted.map(gap => {
        const style = STATUS_STYLES[gap.status]
        const pct = gap.pct ?? 0
        const barWidth = Math.min(pct, 100)

        // An unmeasured nutrient has consumed = 0 only because every
        // contributor was excluded, not because the dog ate none of it.
        // Rendering "0 mg / 500 mg" and an empty bar would assert a deficiency
        // we have no evidence for, which is exactly the "missing ≠ zero" bug
        // the engine exists to prevent. Show the absence instead.
        const isUnmeasured = gap.status === 'unmeasured'

        return (
          <li key={gap.nutrientKey} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">
                {NUTRIENT_LABELS[gap.nutrientKey] ?? gap.nutrientKey}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  {isUnmeasured ? (
                    'not reported'
                  ) : (
                    <>
                      {formatAmount(gap.consumed, gap.unit)}
                      {gap.dailyTarget != null &&
                        ` / ${formatAmount(gap.dailyTarget, gap.unit)}`}
                    </>
                  )}
                </span>
                <Badge variant="outline" className={cn('border-0', style.badge)}>
                  {style.label}
                  {!isUnmeasured &&
                    gap.pct != null &&
                    ` · ${Math.round(gap.pct)}%`}
                </Badge>
              </span>
            </div>
            {gap.dailyTarget != null && !isUnmeasured && (
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full transition-all', style.bar)}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
