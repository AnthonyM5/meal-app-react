import {
  NUTRIENT_LABELS,
  TRACKED_NUTRIENTS,
  type GapStatus,
  type NutrientGap,
  type NutrientKey,
} from '@pawplate/core'

// Mirrors the semantics of apps/web/components/nutrient-gap-bars.tsx in a
// compact mobile layout.
const STATUS_BAR: Record<GapStatus, string> = {
  deficient: 'bg-amber-500',
  adequate: 'bg-primary',
  excess: 'bg-orange-500',
  toxic_risk: 'bg-destructive',
  informational: 'bg-muted-foreground/40',
  unmeasured: 'bg-muted-foreground/20',
}

const STATUS_LABEL: Record<GapStatus, string | null> = {
  deficient: 'Low',
  adequate: 'OK',
  excess: 'High',
  toxic_risk: 'Over safe max',
  informational: null,
  unmeasured: 'Not measured',
}

function formatAmount(value: number): string {
  if (value >= 100) return String(Math.round(value))
  if (value >= 1) return value.toFixed(1)
  return value.toFixed(2)
}

export function GapBars({
  gaps,
}: {
  gaps: Partial<Record<NutrientKey, NutrientGap>>
}) {
  const entries = TRACKED_NUTRIENTS.map(key => gaps[key]).filter(
    (gap): gap is NutrientGap => gap != null
  )

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No nutrient data for this day yet.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {entries.map(gap => {
        const pct = gap.pct ?? 0
        const width = Math.max(0, Math.min(pct, 100))
        const statusLabel = STATUS_LABEL[gap.status]
        return (
          <div key={gap.nutrientKey}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span>{NUTRIENT_LABELS[gap.nutrientKey]}</span>
              <span className="text-xs text-muted-foreground">
                {formatAmount(gap.consumed)}
                {gap.dailyTarget != null &&
                  ` / ${formatAmount(gap.dailyTarget)}`}{' '}
                {gap.unit}
                {statusLabel && ` · ${statusLabel}`}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className={`h-full rounded-full ${STATUS_BAR[gap.status]}`}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
