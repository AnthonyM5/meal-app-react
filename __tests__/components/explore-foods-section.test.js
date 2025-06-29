import { ExploreFoodsSection } from '@/components/explore-foods-section'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

describe('ExploreFoodsSection', () => {
  it('should render search input', () => {
    render(<ExploreFoodsSection />)
    const searchInput = screen.getByPlaceholderText(/search for foods/i)
    expect(searchInput).toBeInTheDocument()
  })

  it('should handle search input change', () => {
    render(<ExploreFoodsSection />)
    const searchInput = screen.getByPlaceholderText(/search for foods/i)
    fireEvent.change(searchInput, { target: { value: 'apple' } })
    expect(searchInput.value).toBe('apple')
  })
})
