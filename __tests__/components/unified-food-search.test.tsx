import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Mock all dependencies before any imports
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('@/lib/food-actions', () => ({
  addFoodToMeal: jest.fn(),
}))

jest.mock('next/link', () => {
  return function MockLink({ children, href, onClick, className }: any) {
    return (
      <a href={href} onClick={onClick} className={className}>
        {children}
      </a>
    )
  }
})

// Mock fetch
global.fetch = jest.fn()

// Import after mocks
import { UnifiedFoodSearch } from '@/components/unified-food-search'
import { addFoodToMeal } from '@/lib/food-actions'
import { toast } from 'sonner'

const mockAddFoodToMeal = addFoodToMeal as jest.MockedFunction<typeof addFoodToMeal>
const mockToast = toast as any

describe('UnifiedFoodSearch', () => {
  const mockProps = {
    mealType: 'breakfast' as const,
    onFoodAdded: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
  })

  test('renders search input', () => {
    render(<UnifiedFoodSearch {...mockProps} />)
    const input = screen.getByPlaceholderText('Search for a food...')
    if (!input) throw new Error('Search input not found')
  })

  test('handles search input changes', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ foods: [] })
    })

    render(<UnifiedFoodSearch {...mockProps} />)
    const input = screen.getByPlaceholderText('Search for a food...')
    
    fireEvent.change(input, { target: { value: 'apple' } })
    
    // Verify input value changed
    if ((input as HTMLInputElement).value !== 'apple') {
      throw new Error('Input value did not change')
    }
  })

  test('displays search results', async () => {
    const mockFoods = [
      { 
        id: '1', 
        name: 'Apple', 
        calories_per_serving: 95, 
        serving_size: '1 medium',
        serving_unit: 'piece'
      }
    ]
    
    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ foods: mockFoods })
    })

    render(<UnifiedFoodSearch {...mockProps} />)
    const input = screen.getByPlaceholderText('Search for a food...')
    
    fireEvent.change(input, { target: { value: 'apple' } })
    fireEvent.focus(input)

    await waitFor(() => {
      const appleText = screen.getByText('Apple')
      if (!appleText) throw new Error('Apple text not found')
      
      const calorieText = screen.getByText('95 kcal per 1 medium')
      if (!calorieText) throw new Error('Calorie text not found')
    })
  })

  test('handles successful food addition', async () => {
    const mockFood = { 
      id: '1', 
      name: 'Apple', 
      calories_per_serving: 95, 
      serving_size: '1 medium' 
    }
    
    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ foods: [mockFood] })
    })
    
    mockAddFoodToMeal.mockResolvedValue(undefined)

    render(<UnifiedFoodSearch {...mockProps} />)
    const input = screen.getByPlaceholderText('Search for a food...')
    
    fireEvent.change(input, { target: { value: 'apple' } })
    fireEvent.focus(input)

    await waitFor(() => {
      const appleText = screen.getByText('Apple')
      if (!appleText) throw new Error('Apple text not found')
    })

    const addButton = screen.getByText('Add')
    fireEvent.click(addButton)

    await waitFor(() => {
      if (!mockAddFoodToMeal.mock.calls.length) {
        throw new Error('addFoodToMeal was not called')
      }
      
      const [foodId, mealType] = mockAddFoodToMeal.mock.calls[0]
      if (foodId !== '1') throw new Error(`Expected foodId '1', got ${foodId}`)
      if (mealType !== 'breakfast') throw new Error(`Expected mealType 'breakfast', got ${mealType}`)
      
      if (!mockToast.success.mock.calls.length) {
        throw new Error('Toast success was not called')
      }
      
      if (!mockProps.onFoodAdded.mock.calls.length) {
        throw new Error('onFoodAdded was not called')
      }
    })
  })

  test('shows no results message when no foods found', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ foods: [] })
    })

    render(<UnifiedFoodSearch {...mockProps} />)
    const input = screen.getByPlaceholderText('Search for a food...')
    
    fireEvent.change(input, { target: { value: 'xyz' } })
    fireEvent.focus(input)

    await waitFor(() => {
      const noResultsText = screen.getByText('No results found for "xyz".')
      if (!noResultsText) throw new Error('No results message not found')
    })
  })
})
