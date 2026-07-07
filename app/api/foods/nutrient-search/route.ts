import { TRACKED_NUTRIENTS, type NutrientKey } from '@/lib/canine-nutrition'
import type { Database } from '@/lib/types'
import { createClient } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'

function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Defense in depth: the RPC also validates against information_schema, but
// checking the exact tracked-nutrient set here means an unrecognized param
// never reaches the database at all.
function isSearchableNutrient(value: string): value is NutrientKey {
  return (TRACKED_NUTRIENTS as readonly string[]).includes(value)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const nutrient = searchParams.get('nutrient')
    const minAmount = Number.parseFloat(searchParams.get('min') || '0')

    if (!nutrient || !isSearchableNutrient(nutrient)) {
      return NextResponse.json(
        { error: 'nutrient must be one of the tracked canine nutrients' },
        { status: 400 }
      )
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { foods: [], error: 'Database not configured' },
        { status: 503 }
      )
    }

    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: foods, error } = await supabase.rpc(
      'search_foods_by_nutrient',
      {
        nutrient_column: nutrient,
        min_amount: Number.isFinite(minAmount) ? minAmount : 0,
        limit_count: 50,
      }
    )

    if (error) {
      console.error('Nutrient search error:', error)
      return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }

    return NextResponse.json({ foods: foods || [] })
  } catch (error) {
    console.error('Nutrient search API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
