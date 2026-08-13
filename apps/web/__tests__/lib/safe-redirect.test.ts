import { describe, expect, it } from '@jest/globals'
import { DEFAULT_REDIRECT, safeRedirectPath } from '@/lib/safe-redirect'

// Guards the open redirect in app/auth/callback/route.ts: `?next=` was passed
// straight to `new URL(next, origin)`, which silently discards the base for
// absolute and protocol-relative inputs — so a link to our own domain could
// bounce the user to an attacker's page immediately after a real, successful
// sign-in.

const ORIGIN = 'https://pawplate.app'

describe('safeRedirectPath', () => {
  describe('rejects off-origin targets', () => {
    it.each([
      ['absolute https URL', 'https://evil.com'],
      ['absolute https URL with path', 'https://evil.com/phish?a=1'],
      ['protocol-relative', '//evil.com/x'],
      // Starts with '/', so `next.startsWith('/')` accepts it — but WHATWG URL
      // parsing treats the backslash as a separator, giving https://evil.com/.
      // This is the case that makes the naive fix wrong.
      ['backslash-escaped host', '/\\evil.com'],
      ['double backslash', '\\\\evil.com'],
      ['subdomain of an attacker domain', 'https://pawplate.app.evil.com/x'],
      ['userinfo trick', 'https://pawplate.app@evil.com/'],
      ['plain http downgrade of our own host', 'http://pawplate.app/dashboard'],
    ])('%s', (_label, input) => {
      expect(safeRedirectPath(input, ORIGIN)).toBe(DEFAULT_REDIRECT)
    })
  })

  describe('rejects non-http schemes', () => {
    it.each([
      ['javascript', 'javascript:alert(1)'],
      ['data', 'data:text/html,<script>alert(1)</script>'],
      ['mailto', 'mailto:someone@example.com'],
    ])('%s', (_label, input) => {
      expect(safeRedirectPath(input, ORIGIN)).toBe(DEFAULT_REDIRECT)
    })
  })

  describe('falls back when there is nothing usable', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['empty string', ''],
      ['bare slash (would loop through the landing gate)', '/'],
    ])('%s', (_label, input) => {
      expect(safeRedirectPath(input, ORIGIN)).toBe(DEFAULT_REDIRECT)
    })
  })

  describe('preserves legitimate same-origin deep links', () => {
    it.each([
      ['simple path', '/dashboard', '/dashboard'],
      ['nested path', '/dogs/123/meals', '/dogs/123/meals'],
      ['path with query', '/foods?q=chicken', '/foods?q=chicken'],
      ['path with hash', '/dashboard#today', '/dashboard#today'],
      ['query and hash', '/foods?q=beef#results', '/foods?q=beef#results'],
      ['encoded characters survive', '/foods?q=ground%20beef', '/foods?q=ground%20beef'],
    ])('%s', (_label, input, expected) => {
      expect(safeRedirectPath(input, ORIGIN)).toBe(expected)
    })

    it('accepts an absolute URL on our own origin, returning just the path', () => {
      expect(safeRedirectPath(`${ORIGIN}/dashboard?x=1`, ORIGIN)).toBe(
        '/dashboard?x=1'
      )
    })
  })

  it('never returns an absolute URL, whatever the input', () => {
    const inputs = [
      '/dashboard',
      'https://evil.com',
      `${ORIGIN}/dogs`,
      '//evil.com',
      '/\\evil.com',
      'javascript:alert(1)',
      null,
    ]
    for (const input of inputs) {
      const result = safeRedirectPath(input, ORIGIN)
      expect(result.startsWith('/')).toBe(true)
      // A leading '//' would be read as protocol-relative by the browser.
      expect(result.startsWith('//')).toBe(false)
    }
  })

  it('works for a localhost origin (dev / e2e)', () => {
    const dev = 'http://localhost:3000'
    expect(safeRedirectPath('/dashboard', dev)).toBe('/dashboard')
    expect(safeRedirectPath('https://evil.com', dev)).toBe(DEFAULT_REDIRECT)
    // Same host, different port is a different origin.
    expect(safeRedirectPath('http://localhost:4000/x', dev)).toBe(DEFAULT_REDIRECT)
  })
})
