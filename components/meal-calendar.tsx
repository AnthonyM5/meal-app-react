'use client'

import { Calendar } from '@/components/ui/calendar'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getDogMealDates } from '@/lib/meal-actions'
import { endOfMonth, format, parseISO, startOfMonth } from 'date-fns'
import { useEffect, useState } from 'react'

interface MealCalendarProps {
  dogId: string
  selected: Date
  onSelect: (date: Date) => void
  /** Bump after a meal is logged or deleted so the day markers refresh */
  refreshKey?: number
}

/**
 * Month calendar of the dog's meal history. Days with at least one logged
 * meal get a dot marker; picking a day drives which day the dashboard shows.
 */
export function MealCalendar({
  dogId,
  selected,
  onSelect,
  refreshKey = 0,
}: MealCalendarProps) {
  const [month, setMonth] = useState<Date>(selected)
  const [loggedDates, setLoggedDates] = useState<Date[]>([])

  useEffect(() => {
    let cancelled = false
    const loadMarkers = async () => {
      try {
        const dates = await getDogMealDates(
          dogId,
          format(startOfMonth(month), 'yyyy-MM-dd'),
          format(endOfMonth(month), 'yyyy-MM-dd')
        )
        if (!cancelled) {
          // parseISO reads date-only strings as local midnight, matching the
          // local Date objects react-day-picker uses for its day cells
          setLoggedDates(dates.map(date => parseISO(date)))
        }
      } catch (error) {
        console.error('Error loading meal calendar markers:', error)
      }
    }
    loadMarkers()
    return () => {
      cancelled = true
    }
  }, [dogId, month, refreshKey])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Meal history</CardTitle>
        <CardDescription>
          Pick a day to view or edit its meals — dots mark days with entries
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Calendar
          mode="single"
          required
          selected={selected}
          onSelect={date => date && onSelect(date)}
          month={month}
          onMonthChange={setMonth}
          disabled={{ after: new Date() }}
          modifiers={{ logged: loggedDates }}
          modifiersClassNames={{
            logged:
              'after:pointer-events-none after:absolute after:bottom-1 after:left-1/2 after:z-10 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary [&:has([aria-selected=true])]:after:bg-primary-foreground',
          }}
        />
      </CardContent>
    </Card>
  )
}
