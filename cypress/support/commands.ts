declare namespace Cypress {
  interface Chainable {
    login(email: string, password: string): Chainable<void>
    useGuestMode(): Chainable<void>
  }
}

Cypress.Commands.add('login', (email, password) => {
  cy.visit('/auth/login')
  cy.get('input[name="email"]').type(email)
  cy.get('input[name="password"]').type(password)
  cy.get('button[type="submit"]').click()
  cy.url().should('include', '/dashboard')
})

Cypress.Commands.add('useGuestMode', () => {
  cy.visit('/')
  cy.get('[data-testid="guest-mode-button"]').click()
  cy.url().should('include', '/dashboard')
})
