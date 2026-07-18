import type { Database } from '@/lib/types'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role client for REST route handlers (mobile-facing API, added in
 * the mobile-phasing REST layer — see docs/PAWPLATE_PROGRESS.md). These
 * routes authenticate the caller via a Bearer token (no browser cookies on
 * native), then perform ownership checks explicitly in lib/services/* —
 * same pattern already used by app/api/bowl/analyze/route.ts.
 */

export function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export function getServiceClient(): SupabaseClient<Database> {
  if (!isSupabaseConfigured()) {
    throw new Error('Database not configured')
  }
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
