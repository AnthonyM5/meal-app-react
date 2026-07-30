import { authenticateRequest, errorResponse } from '@/lib/server/rest-auth'
import { type NextRequest, NextResponse } from 'next/server'

// Grouped ingredient search over the canonical layer
// (docs/DATA_NORMALIZATION_DESIGN.md §4.4).
//
// The flat /api/ingredients/search route has to pick one winner out of 960
// "Beef, ..." rows; any such pick is somewhat arbitrary. This returns CANONICAL
// GROUPS instead — "beef" yields ~43 (Beef round, Beef chuck, Beef liver, Beef
// ground, ...), each with its default variant's nutrition inline and a
// variant_count the client can expand via ?canonical_id=.
//
// Additive: the flat route is untouched, so existing web and native callers
// keep working. Clients opt into grouped mode by calling this path.
//
//   GET /api/ingredients/grouped-search?q=beef
//   GET /api/ingredients/grouped-search?canonical_id=<uuid>   -> variants

const MIN_QUERY_LENGTH = 2
const GROUP_LIMIT = 25
const VARIANT_LIMIT = 100

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth instanceof NextResponse) return auth

  const params = new URL(request.url).searchParams
  const canonicalId = params.get('canonical_id')
  const query = params.get('q')

  try {
    // Expansion mode: one group's variants, ordered default-first.
    if (canonicalId) {
      const { data, error } = await auth.supabase.rpc('list_canonical_variants', {
        p_canonical_id: canonicalId,
        match_limit: VARIANT_LIMIT,
      })
      if (error) throw new Error('Variant lookup failed')
      return NextResponse.json({ variants: data ?? [] })
    }

    if (!query || query.length < MIN_QUERY_LENGTH) {
      return NextResponse.json({ groups: [] })
    }

    const { data, error } = await auth.supabase.rpc('search_canonical_ingredients', {
      search_query: query,
      match_limit: GROUP_LIMIT,
    })
    if (error) throw new Error('Grouped search failed')
    return NextResponse.json({ groups: data ?? [] })
  } catch (error) {
    return errorResponse(error)
  }
}
