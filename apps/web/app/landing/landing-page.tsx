import { BrandMark } from '@/components/brand-logo'
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
      <div className="flex min-h-screen items-center justify-center bg-[#1B5E20]">
        <h1 className="mb-4 text-2xl font-bold text-white">
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#1B5E20] p-6 text-center text-white">
        <span className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-white p-1.5 shadow-lg ring-1 ring-white/20">
          <BrandMark className="h-full w-full" title="PawPlate" />
        </span>

        <h1 className="mb-2 font-display text-5xl font-bold leading-tight tracking-tight text-white">
          PawPlate
        </h1>
        <p className="mb-4 font-display text-xl font-medium text-[#FFB74D]">
          Real food. Real results.
        </p>
        <p className="mb-8 max-w-sm text-lg text-white/75">
          Balanced home-cooked meals and nutrient tracking for your dog —
          measured against NRC/AAFCO targets.
        </p>

        <div className="flex w-full max-w-xs flex-col gap-3">
          <Link href="/auth/login" className="w-full">
            <Button className="h-11 w-full bg-[#FFB74D] text-base font-semibold text-[#1F2937] hover:bg-[#F0A32E]">
              Sign In
            </Button>
          </Link>

          <Link href="/auth/sign-up" className="w-full">
            <Button
              variant="outline"
              className="h-11 w-full border-white/40 bg-transparent text-base font-semibold text-white hover:border-white/70 hover:bg-white/10 hover:text-white"
            >
              Create Account
            </Button>
          </Link>

          <GuestModeButton className="text-white/85 hover:bg-white/10 hover:text-white" />
        </div>

        <p className="mt-5 max-w-sm text-sm text-white/50">
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
