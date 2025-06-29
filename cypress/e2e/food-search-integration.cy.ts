describe('Food Search Integration', () => {
  beforeEach(() => {
    // Clear session storage and cookies before each test
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  it('should search for foods in guest mode', () => {
    cy.useGuestMode()

    // Try searching for a food
    cy.get('input[placeholder*="Search for foods"]')
      .should('be.visible')
      .type('apple')

    // Verify results appear
    cy.get('[data-testid="food-item"]')
      .should('have.length.at.least', 1)
      .first()
      .should('contain.text', 'apple')
  })

  it('should search for foods as logged in user', () => {
    cy.login('test@example.com', 'password')

    // Try searching for a food
    cy.get('input[placeholder*="Search for foods"]')
      .should('be.visible')
      .type('banana')

    // Verify results appear
    cy.get('[data-testid="food-item"]')
      .should('have.length.at.least', 1)
      .first()
      .should('contain.text', 'banana')
  })

  it('should allow viewing food details', () => {
    cy.useGuestMode()

    // Search and click on a food item
    cy.get('input[placeholder*="Search for foods"]').type('apple')

    cy.get('[data-testid="food-item"]').first().click()

    // Verify food details page
    cy.url().should('include', '/food-details/')
    cy.get('[data-testid="nutrient-info"]').should('be.visible')
  })
})
