import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const PUBLIC_ROUTES = ['/', '/auth/login', '/auth/sign-up']
const GUEST_ALLOWED_ROUTES = ['/dashboard', '/food-details']

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createMiddlewareClient({ req: request, res: response })
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const isGuestMode = request.cookies.get('guestMode')?.value === 'true'
  const path = request.nextUrl.pathname

  // Allow access to public routes
  if (PUBLIC_ROUTES.includes(path)) {
    return response
  }

  // Check if route is allowed for guests
  const isGuestAllowedRoute = GUEST_ALLOWED_ROUTES.some(route =>
    path.startsWith(route)
  )

  // Allow access if user is authenticated or in guest mode on allowed routes
  if (session || (isGuestMode && isGuestAllowedRoute)) {
    return response
  }

  // Redirect to login if not public route and not authenticated/guest
  return NextResponse.redirect(new URL('/auth/login', request.url))
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
