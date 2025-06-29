import type { Database } from '@/lib/types'
import { createClient } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  console.log('Unified search request:', searchParams.toString())
  const query = searchParams.get('q')

  if (!query || query.length < 2) {
    return NextResponse.json({ foods: [] })
  }

  try {
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Search local database with comprehensive matching
    const { data: foods, error } = await supabase
      .from('foods')
      .select('*')
      .or(`name.ilike.%${query}%, brand.ilike.%${query}%`)
      .limit(50)
      .order('is_verified', { ascending: false })
      .order('name')

    if (error) {
      console.error('Database search error:', error)
      return NextResponse.json({ foods: [] })
    }

    return NextResponse.json({ foods: foods || [] })
  } catch (error) {
    console.error('Unified search error:', error)
    return NextResponse.json({ foods: [] })
  }
}
