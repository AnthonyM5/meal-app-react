/**
 * Resolve a caller-supplied post-login redirect target to a safe, same-origin
 * path.
 *
 * The OAuth callback accepts `?next=` so a user who followed a deep link can be
 * returned to it after signing in. That parameter is fully attacker-controlled,
 * and `new URL(next, origin)` does NOT keep you on `origin` — it happily
 * discards the base for anything that parses as absolute or protocol-relative:
 *
 *   new URL('/dashboard',       'https://app.example') -> https://app.example/dashboard
 *   new URL('https://evil.com', 'https://app.example') -> https://evil.com/
 *   new URL('//evil.com/x',     'https://app.example') -> https://evil.com/x
 *   new URL('/\\evil.com',      'https://app.example') -> https://evil.com/
 *
 * Landing a user on an attacker's page immediately after a genuine, successful
 * sign-in is a strong phishing primitive, so this is a real hole rather than a
 * cosmetic one.
 *
 * Note the fourth case: `/\evil.com` starts with '/', so the obvious guard
 * (`next.startsWith('/')`) lets it through. WHATWG URL parsing treats a
 * backslash as a path separator in special schemes, making it equivalent to
 * `//evil.com`. Any fix based on inspecting the raw string has to anticipate
 * that, plus tab/newline stripping and percent-encoding. So don't inspect the
 * raw string — resolve it and compare the resulting origin, which is the same
 * computation the browser will perform.
 */
export const DEFAULT_REDIRECT = '/dashboard'

export function safeRedirectPath(
  raw: string | null | undefined,
  origin: string
): string {
  if (!raw) return DEFAULT_REDIRECT

  let resolved: URL
  try {
    resolved = new URL(raw, origin)
  } catch {
    // Not parseable even against a base — nothing safe to salvage.
    return DEFAULT_REDIRECT
  }

  // The only test that matters. This rejects other hosts, and also rejects
  // scheme changes on the same host (javascript:, data:, http: when the origin
  // is https:) — URL.origin is "null" for non-special schemes and differs on
  // protocol for the rest.
  if (resolved.origin !== origin) return DEFAULT_REDIRECT

  // Return a path, never an absolute URL: the caller re-resolves it against
  // its own origin, so a bug there can't be turned into an off-site jump.
  const path = `${resolved.pathname}${resolved.search}${resolved.hash}`

  // `new URL('', origin)` yields pathname '/', which is a redirect loop risk
  // for a post-login destination (it bounces through the landing gate again).
  return path === '/' ? DEFAULT_REDIRECT : path
}
