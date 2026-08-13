import { safeRedirectPath } from '@/lib/safe-redirect'
import type { Database } from '@/lib/types'
import type { CookieOptions } from '@supabase/ssr'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

// OAuth (e.g. Google) redirects back here with a `?code=...` after the user
// consents. We exchange it for a session cookie, then send them on to `next`
// (defaults to /dashboard). Cookie wiring mirrors lib/actions.ts.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  // `next` is attacker-controlled; safeRedirectPath keeps us on this origin.
  // See lib/safe-redirect.ts for why a startsWith('/') check is not enough.
  const next = safeRedirectPath(searchParams.get('next'), origin)

  if (!code) {
    return NextResponse.redirect(new URL('/auth/login?error=oauth', origin))
  }

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

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(new URL('/auth/login?error=oauth', origin))
  }

  // Clear any guest-mode cookie on successful sign-in (same as signIn).
  cookieStore.set('guestMode', '', { path: '/', maxAge: 0 })

  return NextResponse.redirect(new URL(next, origin))
}
