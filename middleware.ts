import type { Database } from '@/lib/types'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// Routes that don't require auth
const PUBLIC_ROUTES = ['/', '/auth/login', '/auth/sign-up']

// Routes that allow guest access
const GUEST_ALLOWED_ROUTES = ['/dashboard', '/food-details', '/api/foods']

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

// Update matcher to cover all routes
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}