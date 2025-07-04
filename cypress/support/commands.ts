declare namespace Cypress {
  interface Chainable {
    login(email: string, password: string): Chainable<void>
    useGuestMode(): Chainable<void>
    searchFood(query: string): Chainable<void>
    waitForSearchResults(): Chainable<void>
  }
}

Cypress.Commands.add('login', (email, password) => {
  cy.visit('/auth/login')
  cy.get('input[name="email"]').type(email)
  cy.get('input[name="password"]').type(password)
  cy.get('button[type="submit"]').click()
  // Wait for either dashboard or error
  cy.url().should('satisfy', (url) => {
    return url.includes('/dashboard') || url.includes('/auth/login')
  })
})

Cypress.Commands.add('useGuestMode', () => {
  cy.visit('/')
  cy.get('[data-testid="guest-mode-button"]').click()
  cy.url().should('include', '/dashboard')
})

Cypress.Commands.add('searchFood', (query: string) => {
  cy.get('input[placeholder*="Search for foods"]')
    .should('be.visible')
    .clear()
    .type(query)
})

Cypress.Commands.add('waitForSearchResults', () => {
  cy.get('[data-testid="food-item"]', { timeout: 10000 })
    .should('have.length.at.least', 1)
})
