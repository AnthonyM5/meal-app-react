describe('Responsive Design and Mobile Compatibility', () => {
  const viewports = [
    { device: 'mobile', width: 375, height: 667 },
    { device: 'tablet', width: 768, height: 1024 },
    { device: 'desktop', width: 1280, height: 720 }
  ]

  viewports.forEach(({ device, width, height }) => {
    describe(`${device} viewport (${width}x${height})`, () => {
      beforeEach(() => {
        cy.viewport(width, height)
        cy.clearLocalStorage()
        cy.clearCookies()
        cy.visit('/')
      })

      it('should display landing page correctly', () => {
        // Title should be visible
        cy.contains('Welcome to NutriTrack').should('be.visible')
        
        // Auth buttons should be accessible
        cy.get('a[href="/auth/login"]').should('be.visible')
        cy.get('a[href="/auth/sign-up"]').should('be.visible')
        cy.get('[data-testid="guest-mode-button"]').should('be.visible')
      })

      it('should handle guest mode dashboard', () => {
        cy.get('[data-testid="guest-mode-button"]').click()
        cy.url().should('include', '/dashboard')

        // Guest banner should be visible
        cy.get('[data-testid="guest-banner"]').should('be.visible')
        
        // Search should be accessible
        cy.get('input[placeholder*="Search for foods"]').should('be.visible')
      })

      it('should handle food search interaction', () => {
        cy.get('[data-testid="guest-mode-button"]').click()
        
        // Search input should be usable
        cy.get('input[placeholder*="Search for foods"]')
          .should('be.visible')
          .type('apple')
        
        // Results should appear
        cy.get('[data-testid="food-item"]', { timeout: 10000 })
          .should('have.length.at.least', 1)
          .first()
          .should('be.visible')
      })

      it('should navigate to food details', () => {
        cy.get('[data-testid="guest-mode-button"]').click()
        cy.get('input[placeholder*="Search for foods"]').type('banana')
        
        cy.get('[data-testid="food-item"]', { timeout: 10000 })
          .first()
          .click()
        
        cy.url().should('include', '/food-details/')
        cy.get('[data-testid="nutrient-info"]', { timeout: 5000 }).should('be.visible')
      })

      if (device === 'mobile') {
        it('should handle mobile-specific interactions', () => {
          cy.get('[data-testid="guest-mode-button"]').click()
          
          // Touch interactions should work
          cy.get('input[placeholder*="Search for foods"]')
            .should('be.visible')
            .click()
            .type('orange')
          
          cy.get('[data-testid="food-item"]', { timeout: 10000 })
            .first()
            .should('be.visible')
            .click()
          
          cy.url().should('include', '/food-details/')
        })
      }
    })
  })

  describe('Cross-viewport consistency', () => {
    it('should maintain functionality across all viewports', () => {
      viewports.forEach(({ width, height }) => {
        cy.viewport(width, height)
        cy.visit('/')
        
        // Basic functionality should work
        cy.get('[data-testid="guest-mode-button"]').should('be.visible').click()
        cy.url().should('include', '/dashboard')
        
        // Search should work
        cy.get('input[placeholder*="Search for foods"]').should('be.visible')
      })
    })
  })
})
