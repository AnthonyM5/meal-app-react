import type { Database } from '@/lib/types'
import { createClient } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'

// The RLS policy on `foods` only grants SELECT to the `authenticated` role,
// so guest-mode users (anon key, no session) can't read it directly — same
// reason unified-search and nutrient-search proxy through the service role
// instead of querying the table from the client.
function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ foodId: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 503 }
    )
  }

  const { foodId } = await params

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
    .from('foods')
    .select('*')
    .eq('id', foodId)
    .maybeSingle()

  if (error) {
    console.error('Food lookup error:', error)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Food not found' }, { status: 404 })
  }

  return NextResponse.json({ food: data })
}
