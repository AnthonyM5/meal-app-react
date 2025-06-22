import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types'

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

export default async function Home() {
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
    // Get the user from the server
    const client = await createClient()
    if (isDummyClient(client)) {
      console.warn('Database client not properly initialized')
      redirect('/auth/login')
    }

    const {
      data: { user },
      error,
    } = await client.auth.getUser()

    // If there's an error checking auth, show login page
    if (error) {
      console.error('Auth error:', error.message)
      return redirect('/auth/login')
    }

    // If we have a user, redirect to dashboard
    if (user) {
      return redirect('/dashboard')
    }

    // If no user but no error, show landing page content
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#161616] px-4 text-white">
        <h1 className="text-4xl font-bold mb-4">Welcome to Meal Tracker</h1>
        <p className="text-xl mb-8">Track your meals and nutrition easily</p>
        <div className="space-x-4">
          <a href="/auth/login" className="bg-[#2b725e] hover:bg-[#235e4c] px-6 py-3 rounded-lg font-medium">
            Login
          </a>
          <a href="/auth/sign-up" className="bg-white hover:bg-gray-100 text-black px-6 py-3 rounded-lg font-medium">
            Sign Up
          </a>
        </div>
      </div>
    )
  } catch (error) {
    // Only log non-redirect errors
    if (!(error as Error)?.message?.includes('NEXT_REDIRECT')) {
      console.error('Error in home page:', error)
    }
    return redirect('/auth/login')
  }
}
