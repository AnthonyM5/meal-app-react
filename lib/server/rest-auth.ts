import { getServiceClient, isSupabaseConfigured } from '@/lib/server/service-client'
import type { Database } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'

/**
 * Resolve the calling user from an `Authorization: Bearer <access_token>`
 * header — the mobile shell holds its Supabase session itself (no httpOnly
 * cookie, per the mobile-strategy auth notes in docs/PAWPLATE_PROGRESS.md)
 * and sends the access token on every REST call instead.
 *
 * Returns either `{ supabase, userId }` (service-role client — ownership is
 * checked explicitly in lib/services/*, same as app/api/bowl/analyze) or a
 * ready-to-return NextResponse error. Callers narrow with `instanceof`.
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<
  | { supabase: SupabaseClient<Database>; userId: string }
  | NextResponse
> {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const authHeader = request.headers.get('authorization') ?? ''
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!match) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const supabase = getServiceClient()
  const { data, error } = await supabase.auth.getUser(match[1])
  if (error || !data.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  return { supabase, userId: data.user.id }
}

/**
 * Map a thrown service-layer Error to an HTTP response. lib/services/* throw
 * plain Errors with human-readable messages (no error-code taxonomy in this
 * codebase) — this keeps every REST route's status mapping consistent
 * instead of guessing per call site.
 */
export function errorResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : 'Something went wrong'
  const status = /not found/i.test(message)
    ? 404
    : /unauthorized/i.test(message)
      ? 403
      : /required|must be|must have|greater than 0|non-negative/i.test(message)
        ? 400
        : 500
  console.error('REST API error:', error)
  return NextResponse.json({ error: message }, { status })
}
