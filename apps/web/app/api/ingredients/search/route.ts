import { authenticateRequest, errorResponse } from '@/lib/server/rest-auth'
import { type NextRequest, NextResponse } from 'next/server'

// Mobile-facing REST wrapper over the same fuzzy_search_foods RPC that
// /api/foods/unified-search uses for the web meal builder. That route has no
// auth of its own (it relies on middleware's cookie/guest gate), so a
// Bearer-token native client can't reach it — this one requires a valid
// access token like every other route in BEARER_AUTH_ROUTES.

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth instanceof NextResponse) return auth

  const query = new URL(request.url).searchParams.get('q')
  if (!query || query.length < 2) {
    return NextResponse.json({ foods: [] })
  }

  try {
    const { data: foods, error } = await auth.supabase.rpc(
      'fuzzy_search_foods',
      {
        search_query: query,
        match_limit: 50,
      }
    )
    if (error) throw new Error('Database search failed')
    return NextResponse.json({ foods: foods ?? [] })
  } catch (error) {
    return errorResponse(error)
  }
}
