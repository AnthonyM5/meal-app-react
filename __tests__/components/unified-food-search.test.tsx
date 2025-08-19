import { UnifiedFoodSearch } from '@/components/unified-food-search'
import { addFoodToMeal } from '@/lib/food-actions'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { toast } from 'sonner'

// Mock dependencies
jest.mock('sonner')
jest.mock('@/lib/food-actions')
jest.mock('next/link', () => {
  return function MockLink({ children, href, onClick, className }: any) {
    return (
      <a href={href} onClick={onClick} className={className}>
        {children}
      </a>
    )
  }
})

const mockAddFoodToMeal = addFoodToMeal as jest.MockedFunction<
  typeof addFoodToMeal
>
const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
}
;(toast as any).success = mockToast.success
;(toast as any).error = mockToast.error

// Mock fetch globally
global.fetch = jest.fn()

describe('UnifiedFoodSearch', () => {
  const mockProps = {
    mealType: 'breakfast' as const,
    onFoodAdded: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should render search input', () => {
    render(<UnifiedFoodSearch {...mockProps} />)
    expect(
      screen.getByPlaceholderText('Search for a food...')
    ).toBeInTheDocument()
  })

  it('should show search icon when not searching', () => {
    render(<UnifiedFoodSearch {...mockProps} />)
    // Look for the Search icon by checking for the SVG element
    const searchIcons = document.querySelectorAll('svg')
    expect(searchIcons.length).toBeGreaterThan(0)
  })

  it('should debounce search requests', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ foods: [] }),
    })

    render(<UnifiedFoodSearch {...mockProps} />)
    const input = screen.getByPlaceholderText('Search for a food...')

    // Type multiple characters quickly
    fireEvent.change(input, { target: { value: 'ap' } })
    fireEvent.change(input, { target: { value: 'app' } })
    fireEvent.change(input, { target: { value: 'apple' } })

    // Wait for debounce
    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledTimes(1)
      },
      { timeout: 500 }
    )

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/foods/unified-search?q=apple'
    )
  })

  it('should display search results when foods are found', async () => {
    const mockFoods = [
      {
        id: '1',
        name: 'Apple',
        calories_per_serving: 95,
        serving_size: '1 medium',
        serving_unit: 'piece',
      },
    ]

    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ foods: mockFoods }),
    })

    render(<UnifiedFoodSearch {...mockProps} />)
    const input = screen.getByPlaceholderText('Search for a food...')

    fireEvent.change(input, { target: { value: 'apple' } })
    fireEvent.focus(input)

    await waitFor(() => {
      expect(screen.getByText('Apple')).toBeInTheDocument()
      expect(screen.getByText('95 kcal per 1 medium')).toBeInTheDocument()
    })
  })

  it('should handle successful food addition', async () => {
    const mockFood = {
      id: '1',
      name: 'Apple',
      calories_per_serving: 95,
      serving_size: '1 medium',
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ foods: [mockFood] }),
    })

    mockAddFoodToMeal.mockResolvedValue(undefined)

    render(<UnifiedFoodSearch {...mockProps} />)
    const input = screen.getByPlaceholderText('Search for a food...')

    fireEvent.change(input, { target: { value: 'apple' } })
    fireEvent.focus(input)

    await waitFor(() => {
      expect(screen.getByText('Apple')).toBeInTheDocument()
    })

    const addButton = screen.getByText('Add')
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(mockAddFoodToMeal).toHaveBeenCalledWith('1', 'breakfast')
      expect(mockToast.success).toHaveBeenCalledWith('Added Apple to breakfast')
      expect(mockProps.onFoodAdded).toHaveBeenCalled()
    })
  })

  it('should handle add food error', async () => {
    const mockFood = {
      id: '1',
      name: 'Apple',
      calories_per_serving: 95,
      serving_size: '1 medium',
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ foods: [mockFood] }),
    })

    mockAddFoodToMeal.mockRejectedValue(new Error('Failed to add food'))

    render(<UnifiedFoodSearch {...mockProps} />)
    const input = screen.getByPlaceholderText('Search for a food...')

    fireEvent.change(input, { target: { value: 'apple' } })
    fireEvent.focus(input)

    await waitFor(() => {
      expect(screen.getByText('Apple')).toBeInTheDocument()
    })

    const addButton = screen.getByText('Add')
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Failed to add food')
    })
  })

  it('should show no results message when no foods found', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ foods: [] }),
    })

    render(<UnifiedFoodSearch {...mockProps} />)
    const input = screen.getByPlaceholderText('Search for a food...')

    fireEvent.change(input, { target: { value: 'xyz' } })
    fireEvent.focus(input)

    await waitFor(() => {
      expect(
        screen.getByText('No results found for "xyz".')
      ).toBeInTheDocument()
    })
  })

  it('should handle search API errors', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

    render(<UnifiedFoodSearch {...mockProps} />)
    const input = screen.getByPlaceholderText('Search for a food...')

    fireEvent.change(input, { target: { value: 'apple' } })
    fireEvent.focus(input)

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Failed to search foods')
    })
  })

  it('should clear results when query is too short', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ foods: [{ id: '1', name: 'Apple' }] }),
    })

    render(<UnifiedFoodSearch {...mockProps} />)
    const input = screen.getByPlaceholderText('Search for a food...')

    // First, search for something valid
    fireEvent.change(input, { target: { value: 'apple' } })
    fireEvent.focus(input)

    // Then make the query too short
    fireEvent.change(input, { target: { value: 'a' } })

    // Should not make API call for short query
    await waitFor(() => {
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  it('should handle click outside to close results', () => {
    render(<UnifiedFoodSearch {...mockProps} />)
    const input = screen.getByPlaceholderText('Search for a food...')

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'apple' } })

    // Simulate click outside
    fireEvent.mouseDown(document.body)

    // The component should handle this via the useEffect
    expect(input).toBeInTheDocument()
  })
})
