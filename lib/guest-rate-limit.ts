import type { Database } from '@/lib/types'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

// Rate limiting for the unauthenticated guest bowl scan.
//
// The `guestMode` cookie is set client-side, so "guest" is not an identity —
// it's an unauthenticated caller. Every guest scan costs a Gemini vision
// request, so this module is the spend gate. It fails CLOSED: if the database
// is unreachable, or we can't tell who the caller is, the scan is denied.

const DEFAULT_DAILY_LIMIT = 3

/**
 * Coerce a limit to a finite positive integer, falling back to the default.
 *
 * This matters because the value ultimately becomes the RPC's `p_limit`. A
 * misconfigured env var (`GUEST_BOWL_DAILY_LIMIT=abc`) would parse to NaN,
 * which `JSON.stringify` sends to Postgres as `null`; there `count < NULL` is
 * NULL, so the first scan per IP slips through — the opposite of the
 * fail-closed contract this module promises. `0`/negative are rejected too:
 * an intended cap is always >= 1, and the RPC treats <= 0 as "deny everyone".
 */
function sanitizeLimit(value: number): number {
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_DAILY_LIMIT
}

/** Scans per IP per calendar day (UTC, per Postgres CURRENT_DATE). */
export const GUEST_BOWL_DAILY_LIMIT = sanitizeLimit(
  Number.parseInt(process.env.GUEST_BOWL_DAILY_LIMIT || '', 10)
)

/**
 * Best-effort client IP.
 *
 * Trust assumption: we are behind a proxy (Vercel) that OVERWRITES these
 * headers rather than appending to a client-supplied value. Served directly to
 * the internet, both headers are attacker-controlled and this limit is
 * decorative. `x-real-ip` is preferred because it is single-valued and so has
 * no "which entry is the real one" ambiguity to get wrong.
 */
export function extractClientIp(headers: Headers): string | null {
  const realIp = headers.get('x-real-ip')?.trim()
  if (realIp) return realIp

  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    // Left-most entry is the originating client when the proxy is honest.
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }

  return null
}

/**
 * Salted SHA-256, so the usage table is never a list of visitor IPs. The salt
 * must not vary across instances or every deploy resets everyone's quota.
 */
export function hashIp(ip: string): string {
  const salt =
    process.env.GUEST_RATE_LIMIT_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!salt) {
    throw new Error(
      'Cannot hash client IP: set GUEST_RATE_LIMIT_SALT (or SUPABASE_SERVICE_ROLE_KEY)'
    )
  }
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex')
}

export interface QuotaResult {
  allowed: boolean
  /** Safe to show a guest; never contains the IP or the salt. */
  reason?: 'no_client_ip' | 'limit_reached' | 'unavailable'
}

/**
 * Consume one guest scan. Atomic — see `consume_guest_bowl_quota` in
 * migration 20260710000000; a read-then-write here would race.
 */
export async function consumeGuestBowlQuota(
  headers: Headers,
  limit: number = GUEST_BOWL_DAILY_LIMIT
): Promise<QuotaResult> {
  const ip = extractClientIp(headers)
  if (!ip) {
    // Can't meter an anonymous caller we can't bucket. Deny rather than
    // hand out a free, unlimited vision endpoint.
    return { allowed: false, reason: 'no_client_ip' }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return { allowed: false, reason: 'unavailable' }

  // Guard the explicit-override path (the exported default is already
  // sanitized). Never let NaN/Infinity/negative reach the RPC as `p_limit`.
  const safeLimit = sanitizeLimit(limit)

  try {
    const supabase = createClient<Database>(url, serviceKey)
    const { data, error } = await supabase.rpc('consume_guest_bowl_quota', {
      p_ip_hash: hashIp(ip),
      p_limit: safeLimit,
    })

    if (error) {
      console.error('Guest quota check failed:', error.message)
      return { allowed: false, reason: 'unavailable' }
    }
    return data === true
      ? { allowed: true }
      : { allowed: false, reason: 'limit_reached' }
  } catch (error) {
    console.error(
      'Guest quota check threw:',
      error instanceof Error ? error.message : error
    )
    return { allowed: false, reason: 'unavailable' }
  }
}
