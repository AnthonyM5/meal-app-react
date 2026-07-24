import type { Database } from '@/lib/types'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// Routes that don't require auth
const PUBLIC_ROUTES = [
  '/',
  '/auth/login',
  '/auth/sign-up',
  '/auth/callback',
  '/landing',
]

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

// Mobile-facing REST routes (see docs/PAWPLATE_PROGRESS.md, mobile phasing
// step 2) authenticate via `Authorization: Bearer <access_token>` instead of
// the browser session cookie this middleware otherwise gates on — a native
// client has no cookie to send. These routes do their own auth (see
// lib/server/rest-auth.ts) and return a JSON 401, so middleware must not
// intercept them and redirect to the HTML login page first.
//
// Listed as exact prefixes, NOT a blanket '/api/ingredients' — that prefix
// would also match /api/ingredients/import, which (unlike these) has no
// route-level auth check of its own and currently relies entirely on this
// middleware's cookie gate to stay non-public.
const BEARER_AUTH_ROUTES = [
  '/api/dogs',
  '/api/meals',
  '/api/ingredients/manual',
  '/api/ingredients/branded',
  '/api/ingredients/search',
]

// CORS for the Bearer-token routes. The mobile shell runs from a WebView
// origin (capacitor://localhost on iOS, https://localhost on Android;
// http://localhost:5173 in vite dev), so every call here is cross-origin and
// the Authorization header triggers a preflight. A wildcard origin is safe on
// exactly these routes: they carry no cookie auth (wildcard forbids
// credentialed requests anyway), so a foreign page can only use them with an
// access token it already holds — same trust model as calling Supabase's own
// CORS-open REST API.
const BEARER_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Max-Age': '86400',
}

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

  // Bearer-token REST routes authenticate themselves; skip the cookie gate.
  if (BEARER_AUTH_ROUTES.some(route => path.startsWith(route))) {
    if (request.method === 'OPTIONS') {
      // Preflight — the route handlers have no OPTIONS export, so answer here.
      return new NextResponse(null, {
        status: 204,
        headers: BEARER_CORS_HEADERS,
      })
    }
    for (const [key, value] of Object.entries(BEARER_CORS_HEADERS)) {
      response.headers.set(key, value)
    }
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
