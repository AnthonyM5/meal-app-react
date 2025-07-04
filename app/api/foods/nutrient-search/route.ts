import type { Database } from '@/lib/types'
import { createClient } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'

// Check if Supabase environment variables are available
function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && 
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const nutrient = searchParams.get('nutrient')
    const minAmount = Number.parseFloat(searchParams.get('min') || '0')

    if (!nutrient) {
      return NextResponse.json(
        { error: 'Nutrient parameter required' },
        { status: 400 }
      )
    }

    // Check if Supabase is configured
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

    // Use the database function for nutrient search
    const { data: foods, error } = await supabase.rpc(
      'search_foods_by_nutrient',
      {
        nutrient_name: nutrient,
        min_amount: minAmount,
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
