describe('Food Search Integration & Navigation', () => {
  beforeEach(() => {
    // Clear session storage and cookies before each test
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  it('should search for foods in guest mode and view details', () => {
    cy.visit('/')
    cy.get('[data-testid="guest-mode-button"]').click()
    cy.url().should('include', '/dashboard')

    // Search for a food
    cy.get('input[placeholder*="Search for foods"]')
      .should('be.visible')
      .type('apple')

    // Verify results appear
    cy.get('[data-testid="food-item"]', { timeout: 10000 })
      .should('have.length.at.least', 1)

    // Click on first food item to view details
    cy.get('[data-testid="food-item"]').first().click()

    // Verify food details page
    cy.url().should('include', '/food-details/')
    cy.get('[data-testid="nutrient-info"]', { timeout: 5000 }).should('be.visible')
  })

  it('should show guest banner and limitations in guest mode', () => {
    cy.visit('/')
    cy.get('[data-testid="guest-mode-button"]').click()

    // Should show guest banner
    cy.get('[data-testid="guest-banner"]').should('be.visible')
    cy.get('[data-testid="guest-banner"]').should('contain', 'Guest Mode')

    // Try to add food to meal (should show limitation)
    cy.get('input[placeholder*="Search for foods"]').type('apple')
    cy.get('[data-testid="food-item"]', { timeout: 10000 }).first().click()
    
    // Should not be able to add to meal or should show sign-in prompt
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="add-to-meal"]').length === 0) {
        // Button doesn't exist - guest mode working correctly
        expect(true).to.be.true
      } else {
        // Button exists but should show limitation
        cy.get('[data-testid="add-to-meal"]').should('contain', 'Sign in')
      }
    })
  })

  it('should allow exiting guest mode', () => {
    cy.visit('/')
    cy.get('[data-testid="guest-mode-button"]').click()
    
    // Should be in guest mode
    cy.get('[data-testid="guest-banner"]').should('be.visible')
    
    // Exit guest mode
    cy.get('[data-testid="exit-guest-mode"]').click()
    
    // Should redirect to login
    cy.url().should('include', '/auth/login')
  })
})
