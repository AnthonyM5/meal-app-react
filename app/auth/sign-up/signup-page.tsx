import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SignUpForm from '@/components/signup-form'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types'
import { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Sign Up - Meal Tracker',
  description: 'Create a new account',
}

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
}

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

export default async function SignUpPage() {
  // If Supabase is not configured, show setup message
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#161616]">
        <h1 className="text-2xl font-bold mb-4 text-white">
          Connect Supabase to get started
        </h1>
      </div>
    )
  }

  try {
    // Check if user is already logged in
    const client = await createClient()
    if (isDummyClient(client)) {
      console.warn('Database client not properly initialized')
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#161616] px-4 py-12 sm:px-6 lg:px-8">
          <SignUpForm />
        </div>
      )
    }

    const {
      data: { session },
      error,
    } = await client.auth.getSession()

    if (error) {
      console.error('Auth error:', error.message)
    } else if (session) {
      // If user is logged in, redirect to dashboard
      redirect('/dashboard')
    }

    // Show sign up form
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#161616] px-4 py-12 sm:px-6 lg:px-8">
        <SignUpForm />
      </div>
    )
  } catch (error) {
    // Only log non-redirect errors
    if (!(error as Error)?.message?.includes('NEXT_REDIRECT')) {
      console.error('Failed to check auth status:', error)
    }

    // Show sign up form even if we fail to check auth
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#161616] px-4 py-12 sm:px-6 lg:px-8">
        <SignUpForm />
      </div>
    )
  }
}
