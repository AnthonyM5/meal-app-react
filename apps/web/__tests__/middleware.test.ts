/**
 * @jest-environment node
 */
import { beforeAll, describe, expect, it } from '@jest/globals'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { middleware } from '@/middleware'

// Middleware is the ONLY auth gate in front of several API routes. These tests
// pin that boundary so a future edit to its route lists can't silently open a
// hole (or close one that guests legitimately need).
//
// Regression origin: '/api/foods' was listed in GUEST_ALLOWED_ROUTES, which is
// matched by PREFIX. That admitted POST /api/foods/import-external — an
// unauthenticated, service-role WRITE — to anyone who set the client-side
// `guestMode` cookie on themselves. That route (and /api/ingredients/import,
// which had the same shape) has since been deleted; the food catalog is
// populated by scripts/ run with explicit operator credentials.

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://test.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key'
})

/**
 * Run a request through middleware. Returns whether it was redirected to the
 * login page (blocked) or allowed to reach its route handler.
 *
 * No session cookie is ever set, so "allowed" here means allowed *without
 * authenticating* — exactly the property these tests care about.
 */
async function passesGate(
  path: string,
  { method = 'GET', guest = false }: { method?: string; guest?: boolean } = {}
): Promise<boolean> {
  const request = new NextRequest(new URL(`http://localhost:3000${path}`), {
    method,
  })
  if (guest) request.cookies.set('guestMode', 'true')

  const response = await middleware(request)
  const location = response.headers.get('location')
  if (!location) return true

  expect(new URL(location).pathname).toBe('/auth/login')
  return false
}

describe('middleware auth gate', () => {
  // isBearerFoodRead() exempts the ENTIRE /api/foods/ subtree from the cookie
  // gate. That is only sound while every route under it is a read, which no
  // amount of middleware testing can verify — so assert it against the
  // filesystem instead. If someone adds a write handler under /api/foods, this
  // fails and points them at the middleware comment.
  describe('/api/foods/ subtree is read-only (invariant behind isBearerFoodRead)', () => {
    const foodsApiDir = join(__dirname, '..', 'app', 'api', 'foods')

    function routeFiles(dir: string): string[] {
      if (!existsSync(dir)) return []
      return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) return routeFiles(full)
        return entry.name === 'route.ts' || entry.name === 'route.tsx' ? [full] : []
      })
    }

    const files = routeFiles(foodsApiDir)

    it('finds the food routes (guards against a silently empty scan)', () => {
      expect(files.length).toBeGreaterThan(0)
    })

    it.each(files.map(f => [f.slice(f.indexOf('app/api')), f]))(
      '%s exports no mutating handler',
      (_label, file) => {
        const source = readFileSync(file, 'utf8')
        const handlers = [...source.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)]
          .map(m => m[1])
          .filter(name => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(name))
        expect(handlers).toEqual([])
      }
    )
  })

  describe('no blanket /api/ingredients exemption', () => {
    // BEARER_AUTH_ROUTES enumerates ingredient routes one by one on purpose.
    // A path that is not enumerated must still hit the cookie gate — this is
    // what stops an unauthenticated route added later from being auto-exempt.
    it.each([
      ['/api/ingredients/import'],
      ['/api/ingredients/some-future-route'],
    ])('blocks POST %s without a session', async path => {
      expect(await passesGate(path, { method: 'POST' })).toBe(false)
    })

    it('blocks those paths even with a forged guest cookie', async () => {
      expect(
        await passesGate('/api/ingredients/import', { method: 'POST', guest: true })
      ).toBe(false)
    })
  })

  describe('guest-reachable surfaces still work', () => {
    // Read-only food catalog, reached via isBearerFoodRead() — independent of
    // GUEST_ALLOWED_ROUTES. Asserted so the two mechanisms aren't conflated
    // again. Data is global, not user-scoped.
    it.each([
      ['/api/foods/unified-search'],
      ['/api/foods/nutrient-search'],
      ['/api/foods/0f0e0d0c-0b0a-4090-8070-605040302010'],
    ])('allows GET %s without a session', async path => {
      expect(await passesGate(path)).toBe(true)
    })

    // The metered guest bowl scan self-authenticates and has an explicit
    // read-only guest branch.
    it('allows POST /api/bowl/analyze', async () => {
      expect(await passesGate('/api/bowl/analyze', { method: 'POST' })).toBe(true)
    })

    it.each([['/dashboard'], ['/dogs'], ['/foods'], ['/food-details/abc'], ['/bowl']])(
      'allows %s in guest mode',
      async path => {
        expect(await passesGate(path, { guest: true })).toBe(true)
      }
    )
  })

  describe('protected surfaces', () => {
    it.each([['/dashboard'], ['/dogs'], ['/bowl']])(
      'redirects %s to login without a session or guest cookie',
      async path => {
        expect(await passesGate(path)).toBe(false)
      }
    )

    it('does not let an unlisted route ride in on a guest-allowed prefix', async () => {
      expect(await passesGate('/settings', { guest: true })).toBe(false)
    })
  })

  describe('public routes', () => {
    it.each([['/'], ['/auth/login'], ['/auth/sign-up'], ['/landing']])(
      'allows %s',
      async path => {
        expect(await passesGate(path)).toBe(true)
      }
    )
  })
})
