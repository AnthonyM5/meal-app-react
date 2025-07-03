// Mock utilities for testing - not a test file itself
export const mockSupabase = {
  auth: {
    getSession: jest.fn(),
    getUser: jest.fn(),
    signOut: jest.fn(),
  },
}

export const mockSession = {
  data: {
    session: {
      user: {
        id: '123',
        email: 'test@example.com',
      },
    },
  },
  error: null,
}

// This file is intentionally empty of tests to avoid Jest execution
