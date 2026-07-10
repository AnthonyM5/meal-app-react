import { AuthShell } from '@/components/auth-shell'
import SignUpForm from '@/components/signup-form'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import type { Database } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Metadata, Viewport } from 'next'
import { redirect } from 'next/navigation'

function SignUpCard() {
  return (
    <AuthShell>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
          <CardDescription>
            Start tracking your dog&apos;s nutrition — it&apos;s free.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignUpForm />
        </CardContent>
      </Card>
    </AuthShell>
  )
}

export const metadata: Metadata = {
  title: 'Sign Up - PawPlate',
  description: 'Create your PawPlate account',
}

export const viewport: Viewport = {
  themeColor: '#2E7D32',
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
      <div className="flex min-h-screen items-center justify-center bg-[#1B5E20]">
        <h1 className="mb-4 text-2xl font-bold text-white">
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
      return <SignUpCard />
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
    return <SignUpCard />
  } catch (error) {
    // Only log non-redirect errors
    if (!(error as Error)?.message?.includes('NEXT_REDIRECT')) {
      console.error('Failed to check auth status:', error)
    }

    // Show sign up form even if we fail to check auth
    return <SignUpCard />
  }
}
