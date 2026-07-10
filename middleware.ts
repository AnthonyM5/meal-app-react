import type { Database } from '@/lib/types'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// Routes that don't require auth
const PUBLIC_ROUTES = ['/', '/auth/login', '/auth/sign-up']

// Routes that allow guest access.
//
// This list only decides whether middleware lets a request through — it grants
// no data access. Every route below still enforces its own rules: RLS for
// anything user-scoped, and, for /api/bowl, an explicit guest branch that is
// read-only and rate-limited (see app/api/bowl/analyze/route.ts). The
// `guestMode` cookie is client-set, so treat these as public routes.
const GUEST_ALLOWED_ROUTES = [
  '/dashboard',
  '/dogs',
  '/foods',
  '/food-details',
  '/api/foods',
  '/bowl',
  '/api/bowl',
]

// Check if Supabase is configured
function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const path = request.nextUrl.pathname
  const isGuestMode = request.cookies.get('guestMode')?.value === 'true'

  // Allow public routes
  if (PUBLIC_ROUTES.includes(path)) {
    return response
  }

  // Check guest mode access first - before any Supabase calls
  const isGuestAllowedRoute = GUEST_ALLOWED_ROUTES.some(route =>
    path.startsWith(route)
  )

  if (isGuestMode && isGuestAllowedRoute) {
    return response
  }

  // If Supabase is not configured, handle routes without authentication
  if (!isSupabaseConfigured()) {
    // Redirect to login for protected routes when Supabase is not configured
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Only create Supabase client and check session if NOT in guest mode
  if (!isGuestMode) {
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            response.cookies.set(name, value, options)
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set(name, '', { ...options, maxAge: 0 })
          },
        },
      }
    )
    
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session) {
      return response
    }
  }

  // Redirect to login for protected routes
  return NextResponse.redirect(new URL('/auth/login', request.url))
}

// Run on every route EXCEPT Next internals, the metadata/icon routes, and any
// static asset by extension. Without the extension/icon exclusions, requests
// for /icon.svg, /apple-icon.png, /manifest.json, and /og.png get auth-gated
// and 307-redirected to /auth/login — which silently breaks the favicon, the
// PWA manifest, and social-share images for signed-out visitors.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}