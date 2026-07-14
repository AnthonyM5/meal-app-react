import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/types'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

/**
 * Shared auth/client resolution for Server Actions and (future) API route
 * handlers. Previously duplicated across dog-actions.ts and meal-actions.ts.
 *
 * Next-specific behavior (redirect, guest cookie) lives here — never in
 * lib/services/*, which must stay portable to plain REST handlers for the
 * mobile build.
 */

type DummyClient = {
  auth: {
    getUser: () => Promise<{ data: { user: null }; error: null }>
    getSession: () => Promise<{ data: { session: null }; error: null }>
  }
}

function isDummyClient(
  client: SupabaseClient<Database> | DummyClient
): client is DummyClient {
  return !('from' in client)
}

export async function getServerClient(): Promise<SupabaseClient<Database>> {
  const client = await createClient()
  if (isDummyClient(client)) {
    throw new Error('Database client not properly initialized')
  }
  return client as SupabaseClient<Database>
}

export async function getAuthenticatedClientOrRedirect(): Promise<{
  supabase: SupabaseClient<Database>
  user: User
}> {
  const supabase = await getServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/auth/login')
  }

  return { supabase, user }
}

export async function isGuestMode(): Promise<boolean> {
  const client = await getServerClient()
  const {
    data: { session },
  } = await client.auth.getSession()

  if (session) return false

  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  return cookieStore.get('guestMode')?.value === 'true'
}
