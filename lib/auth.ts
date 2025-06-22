'use server'

import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import type { Database } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'

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

export async function getAuthenticatedClient() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured')
  }

  const client = await createClient()
  if (isDummyClient(client)) {
    throw new Error('Database client not properly initialized')
  }

  return client as SupabaseClient<Database>
}

export async function checkAuthStatus() {
  try {
    const client = await getAuthenticatedClient()
    const {
      data: { session },
      error,
    } = await client.auth.getSession()

    if (error) {
      console.error('Auth error:', error.message)
      return { isAuthenticated: false, client }
    }

    return {
      isAuthenticated: !!session,
      client,
      session,
    }
  } catch (error) {
    if (!(error as Error)?.message?.includes('NEXT_REDIRECT')) {
      console.error('Auth check failed:', error)
    }
    return { isAuthenticated: false }
  }
}
