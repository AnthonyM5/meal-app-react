import { addFoodToMeal } from '@/lib/food-actions'

// Mock Supabase
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  select: jest.fn().mockResolvedValue({
    data: [{ id: '1', food_id: 'food-1', meal_type: 'breakfast' }],
    error: null,
  }),
  auth: {
    getUser: jest.fn().mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    }),
  },
}

jest.mock('@/lib/supabase/client', () => ({
  supabase: mockSupabase,
}))

// Mock cookies
jest.mock('next/headers', () => ({
  cookies: () => ({
    get: jest.fn().mockReturnValue({ value: 'mock-session' }),
  }),
}))

describe('Food Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('addFoodToMeal', () => {
    it('should add food to meal successfully for authenticated user', async () => {
      mockSupabase.insert.mockResolvedValue({
        data: [{ id: '1', food_id: 'food-1', meal_type: 'breakfast' }],
        error: null,
      })

      await expect(addFoodToMeal('food-1', 'breakfast')).resolves.not.toThrow()

      expect(mockSupabase.from).toHaveBeenCalledWith('meal_items')
      expect(mockSupabase.insert).toHaveBeenCalled()
    })

    it('should handle database errors', async () => {
      mockSupabase.insert.mockResolvedValue({
        data: null,
        error: { message: 'Database error', code: '23505' },
      })

      await expect(addFoodToMeal('food-1', 'breakfast')).rejects.toThrow(
        'Database error'
      )
    })

    it('should handle authentication errors', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'No user found' },
      })

      await expect(addFoodToMeal('food-1', 'breakfast')).rejects.toThrow()
    })

    it('should validate meal type', async () => {
      await expect(
        addFoodToMeal('food-1', 'invalid-meal' as any)
      ).rejects.toThrow()
    })

    it('should validate food ID', async () => {
      await expect(addFoodToMeal('', 'breakfast')).rejects.toThrow()
      await expect(addFoodToMeal(null as any, 'breakfast')).rejects.toThrow()
    })
  })
})
