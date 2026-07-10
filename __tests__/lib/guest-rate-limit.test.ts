/**
 * The guest bowl endpoint is unauthenticated and spends money on every call,
 * so these tests are mostly about the failure modes: when we can't meter a
 * caller, we must deny — never fall open.
 */
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'
import { createClient } from '@supabase/supabase-js'

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}))

const mockCreateClient = createClient as jest.Mock

// hashIp/consumeGuestBowlQuota read these at call time.
process.env.GUEST_RATE_LIMIT_SALT = 'test-salt'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'

import {
  consumeGuestBowlQuota,
  extractClientIp,
  hashIp,
} from '@/lib/guest-rate-limit'

/** Wire up a fake service-role client whose rpc() resolves to `response`. */
function mockRpc(response: { data?: unknown; error?: { message: string } }) {
  const rpc = jest.fn().mockResolvedValue({
    data: response.data ?? null,
    error: response.error ?? null,
  })
  mockCreateClient.mockReturnValue({ rpc })
  return rpc
}

const headers = (init: Record<string, string>) => new Headers(init)

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('extractClientIp', () => {
  it('prefers x-real-ip, which is single-valued and unambiguous', () => {
    const ip = extractClientIp(
      headers({ 'x-real-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' })
    )
    expect(ip).toBe('1.2.3.4')
  })

  it('falls back to the left-most x-forwarded-for entry', () => {
    const ip = extractClientIp(
      headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1, 10.0.0.2' })
    )
    expect(ip).toBe('1.2.3.4')
  })

  it('returns null when neither header is present', () => {
    expect(extractClientIp(headers({}))).toBeNull()
  })

  it('treats a blank header as absent rather than as an empty bucket', () => {
    expect(extractClientIp(headers({ 'x-real-ip': '   ' }))).toBeNull()
    expect(extractClientIp(headers({ 'x-forwarded-for': ' , ' }))).toBeNull()
  })
})

describe('hashIp', () => {
  it('is deterministic for the same IP', () => {
    expect(hashIp('1.2.3.4')).toBe(hashIp('1.2.3.4'))
  })

  it('separates distinct IPs into distinct buckets', () => {
    expect(hashIp('1.2.3.4')).not.toBe(hashIp('1.2.3.5'))
  })

  it('never embeds the raw IP or the salt in the digest', () => {
    const digest = hashIp('1.2.3.4')
    expect(digest).not.toContain('1.2.3.4')
    expect(digest).not.toContain('test-salt')
    expect(digest).toMatch(/^[0-9a-f]{64}$/)
  })

  it('refuses to hash without a salt rather than emit a reversible digest', () => {
    const salt = process.env.GUEST_RATE_LIMIT_SALT
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.GUEST_RATE_LIMIT_SALT
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    try {
      expect(() => hashIp('1.2.3.4')).toThrow(/GUEST_RATE_LIMIT_SALT/)
    } finally {
      process.env.GUEST_RATE_LIMIT_SALT = salt
      process.env.SUPABASE_SERVICE_ROLE_KEY = key
    }
  })
})

describe('consumeGuestBowlQuota', () => {
  it('allows the call when the RPC reports quota remaining', async () => {
    const rpc = mockRpc({ data: true })
    const result = await consumeGuestBowlQuota(headers({ 'x-real-ip': '1.2.3.4' }))

    expect(result).toEqual({ allowed: true })
    expect(rpc).toHaveBeenCalledWith('consume_guest_bowl_quota', {
      p_ip_hash: hashIp('1.2.3.4'),
      p_limit: 3,
    })
  })

  it('passes the hash, never the raw IP, to the database', async () => {
    const rpc = mockRpc({ data: true })
    await consumeGuestBowlQuota(headers({ 'x-real-ip': '1.2.3.4' }))

    expect(JSON.stringify(rpc.mock.calls)).not.toContain('1.2.3.4')
  })

  it('denies when the RPC reports the limit is reached', async () => {
    mockRpc({ data: false })
    const result = await consumeGuestBowlQuota(
      headers({ 'x-real-ip': '1.2.3.4' })
    )
    expect(result).toEqual({ allowed: false, reason: 'limit_reached' })
  })

  it('denies without calling the database when the caller has no IP', async () => {
    const rpc = mockRpc({ data: true })
    const result = await consumeGuestBowlQuota(headers({}))

    expect(result).toEqual({ allowed: false, reason: 'no_client_ip' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('fails closed when the database returns an error', async () => {
    mockRpc({ error: { message: 'connection refused' } })
    const result = await consumeGuestBowlQuota(
      headers({ 'x-real-ip': '1.2.3.4' })
    )
    expect(result).toEqual({ allowed: false, reason: 'unavailable' })
  })

  it('fails closed when the client throws', async () => {
    mockCreateClient.mockImplementation(() => {
      throw new Error('boom')
    })
    const result = await consumeGuestBowlQuota(
      headers({ 'x-real-ip': '1.2.3.4' })
    )
    expect(result).toEqual({ allowed: false, reason: 'unavailable' })
  })

  it('honors an explicit limit override', async () => {
    const rpc = mockRpc({ data: true })
    await consumeGuestBowlQuota(headers({ 'x-real-ip': '1.2.3.4' }), 10)

    expect(rpc).toHaveBeenCalledWith(
      'consume_guest_bowl_quota',
      expect.objectContaining({ p_limit: 10 })
    )
  })

  it.each([NaN, 0, -5, Infinity, 2.5])(
    'never forwards an invalid limit (%p) to the RPC — falls back to the default',
    async badLimit => {
      const rpc = mockRpc({ data: true })
      await consumeGuestBowlQuota(headers({ 'x-real-ip': '1.2.3.4' }), badLimit)

      // A bad limit must not reach Postgres, where NaN serializes to null and
      // slips the first scan through. It's coerced back to the default (3).
      expect(rpc).toHaveBeenCalledWith(
        'consume_guest_bowl_quota',
        expect.objectContaining({ p_limit: 3 })
      )
    }
  )
})
