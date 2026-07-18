describe('Food Search - Basic Functionality', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('should allow searching for foods on landing page', () => {
    // Navigate to dashboard in guest mode
    cy.get('[data-testid="guest-mode-button"]').click()
    cy.url().should('include', '/dashboard')

    // Search for food
    cy.get('input[placeholder*="Search for foods"]')
      .should('be.visible')
      .type('apple')

    // Wait for search results
    cy.get('[data-testid="food-item"]', { timeout: 10000 }).should('exist')
    cy.get('[data-testid="food-item"]').should('have.length.at.least', 1)
  })

  it('should handle empty search gracefully', () => {
    cy.get('[data-testid="guest-mode-button"]').click()
    
    // Try searching with empty query
    cy.get('input[placeholder*="Search for foods"]')
      .should('be.visible')
      .type(' ')
      .clear()

    // Should not show any results or error
    cy.get('[data-testid="food-item"]').should('not.exist')
  })

  it('should handle search with no results', () => {
    cy.get('[data-testid="guest-mode-button"]').click()
    
    // Search for something that likely won't exist
    cy.get('input[placeholder*="Search for foods"]')
      .should('be.visible')
      .type('xyznoresults123')

    // Should show no results message or empty state
    cy.get('[data-testid="food-item"]').should('not.exist')
  })
})
