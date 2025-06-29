import { GuestModeButton } from '@/components/guest-mode-button'
import { Button } from '@/components/ui/button'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import type { Database } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { redirect } from 'next/navigation'

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
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-[#161616] text-white">
        <h1 className="text-4xl font-bold mb-6">Welcome to NutriTrack</h1>
        <p className="text-xl mb-8">
          Track your nutrition and reach your health goals
        </p>

        <div className="flex flex-col gap-4 w-full max-w-xs">
          <Link href="/auth/login" className="w-full">
            <Button variant="default" className="w-full">
              Sign In
            </Button>
          </Link>

          <Link href="/auth/sign-up" className="w-full">
            <Button variant="outline" className="w-full">
              Create Account
            </Button>
          </Link>

          <GuestModeButton />
        </div>

        <p className="mt-4 text-sm text-gray-500">
          Guest users can search and view nutrition information. Create an
          account to track meals and save favorites.
        </p>
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

// const handleGuestMode = () => {
//   cookies().set('guestMode', 'true', { path: '/' })
// }
