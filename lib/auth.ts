'use server'

import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import type { Database } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

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
    // Check for guest mode first
    const cookieStore = await cookies()
    const isGuestMode =
      cookieStore.has('guestMode') &&
      cookieStore.get('guestMode')?.value === 'true'

    if (isGuestMode) {
      return { isAuthenticated: false, isGuest: true }
    }

    const client = await getAuthenticatedClient()
    const {
      data: { session },
      error,
    } = await client.auth.getSession()

    if (error) {
      console.error('Auth error:', error.message)
      return { isAuthenticated: false, isGuest: false }
    }

    return {
      isAuthenticated: !!session,
      isGuest: false,
      client,
      session,
    }
  } catch (error) {
    if (!(error as Error)?.message?.includes('NEXT_REDIRECT')) {
      console.error('Error checking auth status:', error)
    }
    return { isAuthenticated: false, isGuest: false }
  }
}

// Add type for auth state including guest mode
export type AuthState = {
  isAuthenticated: boolean
  isGuest: boolean
  isLoading: boolean
}

export async function getAuthenticatedUser() {
  const client = await createClient()
  if (isDummyClient(client)) {
    return null
  }

  const {
    data: { user },
    error,
  } = await client.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

export async function isAuthenticated() {
  const user = await getAuthenticatedUser()
  return user !== null
}

export async function getSession() {
  const client = await createClient()
  if (isDummyClient(client)) {
    return null
  }

  const {
    data: { session },
    error,
  } = await client.auth.getSession()

  if (error || !session) {
    return null
  }

  return session
}
