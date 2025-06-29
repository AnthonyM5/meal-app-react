describe('Food Search', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('allows searching for foods', () => {
    cy.get('input[placeholder*="Search for foods"]')
      .should('be.visible')
      .type('apple')

    // Wait for search results
    cy.get('[data-testid="food-item"]').should('exist')
  })

  it('handles guest mode correctly', () => {
    cy.visit('/dashboard')
    cy.get('input[placeholder*="Search for foods"]')
      .should('be.visible')
      .type('apple')

    // Verify search works in guest mode
    cy.get('[data-testid="food-item"]').should('exist')
  })
})
