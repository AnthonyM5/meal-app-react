import { getServiceClient, isSupabaseConfigured } from '@/lib/server/service-client'
import type { Database } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import type { z } from 'zod'

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
 * Parse and validate a JSON request body at the REST boundary. Returns the
 * typed, validated value, or a ready-to-return NextResponse (400). Callers
 * narrow with `instanceof NextResponse`, same as authenticateRequest.
 *
 * Both failure modes a native client can trigger become a clean 400 instead
 * of a 500: a malformed/empty body (request.json() throws a SyntaxError) and
 * a well-formed body with the wrong shape/types (schema rejects it — e.g.
 * `weight_kg: "abc"`, which the service's `<= 0` check would let through).
 */
export async function readJson<S extends z.ZodTypeAny>(
  request: NextRequest,
  schema: S
): Promise<z.infer<S> | NextResponse> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Request body must be valid JSON' },
      { status: 400 }
    )
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const path = issue.path.join('.')
    return NextResponse.json(
      { error: path ? `${path}: ${issue.message}` : issue.message },
      { status: 400 }
    )
  }

  return parsed.data
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
