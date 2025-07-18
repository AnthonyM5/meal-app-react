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
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query || query.length < 2) {
    return NextResponse.json({ foods: [] })
  }

  try {
    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { foods: [], error: 'Database not configured' },
        { status: 503 }
      )
    }

    // Create a Supabase client with the service role key for data access
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Use the new fuzzy search function
    const { data: foods, error: searchError } = await supabase.rpc(
      'fuzzy_search_foods',
      {
        search_query: query,
        match_limit: 50,
      }
    )

    if (searchError) {
      console.error('Database search error:', searchError)
      return NextResponse.json(
        { foods: [], error: 'Database search failed' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { foods: foods || [] },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error) {
    console.error('Unified search error:', error)
    return NextResponse.json(
      { foods: [], error: 'Search failed unexpectedly' },
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  }
}
