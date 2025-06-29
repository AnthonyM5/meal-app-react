# Testing Strategy

This document outlines our testing approach for the Meal App React project.

## Overview

We employ a comprehensive testing strategy that includes:

- Unit Tests (Jest + React Testing Library)
- Integration Tests (Jest + React Testing Library)
- End-to-End Tests (Cypress)

## Test Structure

```
__tests__/                 # Unit and integration tests
├── components/           # Component tests
├── hooks/               # Custom hook tests
└── mocks/               # Test mocks and utilities

cypress/                  # E2E tests
├── e2e/                # Test specs
└── support/            # Custom commands and utilities
```

## Unit Testing

We use Jest and React Testing Library for unit testing. Tests are co-located with the source code in the `__tests__` directory.

### Component Testing

- Test individual component rendering
- Test component interactions
- Test component state changes
- Mock external dependencies

Example:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import ExploreFoodsSection from '@/components/explore-foods-section'

it('should handle search input change', () => {
  render(<ExploreFoodsSection />)
  const searchInput = screen.getByPlaceholderText(/search for foods/i)
  fireEvent.change(searchInput, { target: { value: 'apple' } })
  expect(searchInput.value).toBe('apple')
})
```

### Hook Testing

- Test custom hook behavior
- Test state management
- Test side effects
- Mock external services

Example:

```typescript
import { renderHook, act } from '@testing-library/react'
import { useAuth } from '@/hooks/use-auth'

it('should handle successful login', async () => {
  const { result } = renderHook(() => useAuth())
  await act(async () => {
    await result.current.login('test@example.com', 'password')
  })
})
```

## Integration Testing

Integration tests verify that different parts of the application work together correctly.

Key areas:

- API integration
- Authentication flow
- Data persistence
- Component composition

## End-to-End Testing

We use Cypress for E2E testing to verify complete user workflows.

### Key Workflows Tested

- User authentication (login, signup, logout)
- Guest mode functionality
- Food search and details viewing
- Meal planning and tracking

Example:

```typescript
describe('Food Search Integration', () => {
  it('should search for foods in guest mode', () => {
    cy.useGuestMode()
    cy.get('input[placeholder*="Search for foods"]').type('apple')
    cy.get('[data-testid="food-item"]').should('have.length.at.least', 1)
  })
})
```

## Test Coverage

We maintain high test coverage across the codebase:

- 100% coverage of critical paths
- Minimum 80% overall coverage
- Focus on business logic and user interactions

## Running Tests

Local development:

```bash
# Unit tests
npm test              # Run all unit tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Generate coverage report

# E2E tests
npm run cypress       # Open Cypress UI
npm run test:e2e     # Run E2E tests in headless mode
```

## Continuous Integration

Tests are automatically run in CI/CD pipeline:

- On pull requests
- On main branch pushes
- Before deployment

## Mocking Strategy

We use several mocking approaches:

- Service mocks (e.g., Supabase)
- Component mocks
- API response mocks

Example of Supabase mock:

```typescript
export const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  auth: {
    getSession: jest.fn(),
    signInWithPassword: jest.fn(),
  },
}
```

## Best Practices

1. Test Description:

   - Clear and descriptive test names
   - Use BDD style (describe, it)
   - Document test cases

2. Test Organization:

   - Group related tests
   - Maintain test independence
   - Clean up after tests

3. Assertions:

   - Use explicit assertions
   - Test both positive and negative cases
   - Verify error handling

4. Data Management:
   - Use test fixtures
   - Reset state between tests
   - Mock external dependencies

## Adding New Tests

When adding new features:

1. Write unit tests for new components/hooks
2. Add integration tests for feature interactions
3. Create E2E tests for user workflows
4. Update mocks if needed
5. Verify test coverage

## Debugging Tests

Tips for debugging:

- Use `console.log` in tests
- Use Cypress debugger
- Check test isolation
- Verify mock implementations
