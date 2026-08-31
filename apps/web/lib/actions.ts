'use server'

import type { Database } from '@/lib/types'
import type { CookieOptions } from '@supabase/ssr'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

// Update the signIn function to handle redirects properly
export async function signIn(prevState: { error: string } | null, formData: FormData) {
  const cookieStore = await cookies()

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set(name, value, options)
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set(name, '', { ...options, maxAge: 0 })
        },
      },
    }
  )

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) {
    return { error: error.message }
  }

  // Clear any guest mode cookie on successful login
  cookieStore.set('guestMode', '', { path: '/', maxAge: 0 })

  redirect('/dashboard')
}

// Update the signUp function to handle potential null formData
export async function signUp(prevState: { error: string } | null, formData: FormData) {
  const cookieStore = await cookies()

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set(name, value, options)
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set(name, '', { ...options, maxAge: 0 })
        },
      },
    }
  )

  const { data, error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      data: {
        name: formData.get('name') as string,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  // The project's email-confirmation setting decides what happens next. A
  // returned session means confirmation is OFF, so log the user straight in;
  // otherwise there is no session until the emailed link is clicked, so send
  // them to login with a "check your email" notice. Mirrors the mobile
  // SignupScreen flow. (The old target, /auth/verify, never existed — 404.)
  if (data.session) {
    cookieStore.set('guestMode', '', { path: '/', maxAge: 0 })
    redirect('/dashboard')
  }

  redirect('/auth/login?message=check-email')
}

export async function signOut() {
  const cookieStore = await cookies()

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set(name, value, options)
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set(name, '', { ...options, maxAge: 0 })
        },
      },
    }
  )

  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error('Error signing out:', error.message)
  }

  redirect('/auth/login')
}
