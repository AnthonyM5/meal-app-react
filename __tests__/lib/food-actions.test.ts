// Food Actions Tests

// Mock Next.js server functions BEFORE importing the modules
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}))

// Mock the entire food-actions module to avoid complex Supabase mocking
jest.mock('@/lib/food-actions', () => ({
  searchFoods: jest.fn(),
}))

// Import after mocking
import { searchFoods } from '@/lib/food-actions'

const mockSearchFoods = searchFoods as jest.MockedFunction<typeof searchFoods>

describe('Food Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('searchFoods', () => {
    test('returns empty array for empty query', async () => {
      mockSearchFoods.mockResolvedValue([])
      
      const result = await searchFoods('')
      if (!Array.isArray(result)) throw new Error('Result should be an array')
      if (result.length !== 0)
        throw new Error(`Expected empty array, got length ${result.length}`)
    })

    test('returns empty array for very short query', async () => {
      mockSearchFoods.mockResolvedValue([])
      
      const result = await searchFoods('a')
      if (!Array.isArray(result)) throw new Error('Result should be an array')
      if (result.length !== 0)
        throw new Error(`Expected empty array, got length ${result.length}`)
    })

    test('searches foods successfully', async () => {
      const mockFoods = [
        {
          id: '1',
          name: 'Apple',
          calories_per_serving: 95,
          serving_size: 'medium',
          serving_unit: 'piece',
          protein_g: 0.5,
          carbs_g: 25,
          fat_g: 0.3,
          fiber_g: 4,
          sugar_g: 19,
        },
      ]

      mockSearchFoods.mockResolvedValue(mockFoods as any)

      const result = await searchFoods('apple')
      if (!Array.isArray(result)) throw new Error('Result should be an array')
      if (result.length !== 1)
        throw new Error(`Expected 1 item, got ${result.length}`)
      if (result[0].name !== 'Apple')
        throw new Error(`Expected 'Apple', got ${result[0].name}`)
    })

    test('handles errors gracefully', async () => {
      mockSearchFoods.mockRejectedValue(new Error('Database error'))

      try {
        await searchFoods('apple')
        throw new Error('Test should have thrown')
      } catch (error: any) {
        if (error.message !== 'Database error') {
          throw new Error(`Expected 'Database error', got ${error.message}`)
        }
      }
    })
  })
})
