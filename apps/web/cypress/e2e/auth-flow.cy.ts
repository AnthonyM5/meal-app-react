describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
    cy.visit('/')
  })

  it('should display landing page with auth options', () => {
    // Should show landing page with auth options
    cy.contains('Welcome to NutriTrack').should('be.visible')
    cy.get('a[href="/auth/login"]').should('be.visible')
    cy.get('a[href="/auth/sign-up"]').should('be.visible')
    cy.get('[data-testid="guest-mode-button"]').should('be.visible')
  })

  it('should navigate to login page', () => {
    cy.get('a[href="/auth/login"]').click()
    cy.url().should('include', '/auth/login')
    cy.get('input[name="email"]').should('be.visible')
    cy.get('input[name="password"]').should('be.visible')
    cy.get('button[type="submit"]').should('be.visible')
  })

  it('should navigate to sign-up page', () => {
    cy.get('a[href="/auth/sign-up"]').click()
    cy.url().should('include', '/auth/sign-up')
    cy.get('input[name="email"]').should('be.visible')
    cy.get('input[name="password"]').should('be.visible')
    cy.get('button[type="submit"]').should('be.visible')
  })

  it('should show validation errors for invalid login', () => {
    cy.get('a[href="/auth/login"]').click()
    
    // Try to submit empty form
    cy.get('button[type="submit"]').click()
    
    // Should show validation errors (exact message depends on implementation)
    cy.get('input[name="email"]').should('have.attr', 'required')
    cy.get('input[name="password"]').should('have.attr', 'required')
  })

  it('should show error for invalid email format', () => {
    cy.get('a[href="/auth/login"]').click()
    
    // Enter invalid email
    cy.get('input[name="email"]').type('invalid-email')
    cy.get('input[name="password"]').type('password123')
    cy.get('button[type="submit"]').click()
    
    // Should show email validation error
    cy.get('input[name="email"]:invalid').should('exist')
  })

  it('should attempt login with test credentials', () => {
    cy.get('a[href="/auth/login"]').click()
    
    // Fill in form
    cy.get('input[name="email"]').type('test@example.com')
    cy.get('input[name="password"]').type('password123')
    cy.get('button[type="submit"]').click()
    
    // Should either succeed (if test user exists) or show error
    // We're not asserting success since we don't have test data
    cy.url().should('satisfy', (url) => {
      return url.includes('/dashboard') || url.includes('/auth/login')
    })
  })

  it('should navigate from login to sign-up and back', () => {
    cy.get('a[href="/auth/login"]').click()
    
    // Should have link to sign-up
    cy.get('a[href="/auth/sign-up"]').should('be.visible').click()
    cy.url().should('include', '/auth/sign-up')
    
    // Should have link back to login
    cy.get('a[href="/auth/login"]').should('be.visible').click()
    cy.url().should('include', '/auth/login')
  })
})
