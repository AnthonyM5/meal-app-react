import '@testing-library/jest-dom'
import { renderHook } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { mockSession, mockSupabase } from '../../__tests__/mocks/supabase'
import { useAuth } from '../use-auth'

jest.mock('@/lib/supabase', () => ({
  createClientComponentClient: () => mockSupabase,
}))

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

describe('useAuth', () => {
  const mockRouter = {
    push: jest.fn(),
    refresh: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase.auth.getSession.mockResolvedValue(mockSession)
    useRouter.mockReturnValue(mockRouter)
  })

  it('should handle sign in as guest', async () => {
    const { result } = renderHook(() => useAuth())

    await result.current.signInAsGuest()

    expect(mockRouter.push).toHaveBeenCalledWith('/dashboard')
    expect(window.sessionStorage.getItem('guestMode')).toBe('true')
  })

  it('should handle sign out', async () => {
    const { result } = renderHook(() => useAuth())

    await result.current.signOut()

    expect(mockSupabase.auth.signOut).toHaveBeenCalled()
    expect(mockRouter.push).toHaveBeenCalledWith('/')
    expect(window.sessionStorage.getItem('guestMode')).toBeNull()
  })
})
