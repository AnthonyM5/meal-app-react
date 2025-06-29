import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// Routes that don't require auth
const PUBLIC_ROUTES = ['/', '/auth/login', '/auth/sign-up']

// Routes that allow guest access
const GUEST_ALLOWED_ROUTES = ['/dashboard', '/food-details', '/api/foods']

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createMiddlewareClient({ req: request, res: response })
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const path = request.nextUrl.pathname
  const isGuestMode = request.cookies.get('guestMode')?.value === 'true'

  // Allow public routes
  if (PUBLIC_ROUTES.includes(path)) {
    return response
  }

  // Check guest mode access
  const isGuestAllowedRoute = GUEST_ALLOWED_ROUTES.some(route =>
    path.startsWith(route)
  )

  if (session || (isGuestMode && isGuestAllowedRoute)) {
    return response
  }

  // Redirect to login for protected routes
  return NextResponse.redirect(new URL('/auth/login', request.url))
}

// Update matcher to cover all routes
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
