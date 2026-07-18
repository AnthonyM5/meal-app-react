describe('Dashboard and Meal Tracking', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  describe('Guest Mode Dashboard', () => {
    beforeEach(() => {
      cy.visit('/')
      cy.get('[data-testid="guest-mode-button"]').click()
      cy.url().should('include', '/dashboard')
    })

    it('should display guest banner and limitations', () => {
      // Should show guest banner
      cy.get('[data-testid="guest-banner"]').should('be.visible')
      cy.get('[data-testid="guest-banner"]').should('contain.text', 'Guest Mode')
      
      // Should show explanation about limitations
      cy.get('[data-testid="guest-banner"]').should('contain.text', 'search and view')
    })

    it('should show food search functionality', () => {
      // Should have search input
      cy.get('input[placeholder*="Search for foods"]').should('be.visible')
      
      // Should have search section
      cy.get('[data-testid="explore-foods-section"]').should('be.visible')
    })

    it('should not show meal sections for guests', () => {
      // Guest mode should not show meal tracking sections
      cy.get('[data-testid="meal-section-breakfast"]').should('not.exist')
      cy.get('[data-testid="meal-section-lunch"]').should('not.exist')
      cy.get('[data-testid="meal-section-dinner"]').should('not.exist')
    })

    it('should allow searching and viewing food details', () => {
      // Search for food
      cy.get('input[placeholder*="Search for foods"]').type('banana')
      
      // Wait for results and click first one
      cy.get('[data-testid="food-item"]', { timeout: 10000 })
        .should('have.length.at.least', 1)
        .first()
        .click()
      
      // Should navigate to food details
      cy.url().should('include', '/food-details/')
      
      // Should show nutrition information
      cy.get('[data-testid="nutrient-info"]', { timeout: 5000 }).should('be.visible')
      cy.get('h1').should('contain.text', 'banana')
    })

    it('should provide exit guest mode option', () => {
      // Should have exit guest mode button
      cy.get('[data-testid="exit-guest-mode"]').should('be.visible')
      
      // Clicking should redirect to login
      cy.get('[data-testid="exit-guest-mode"]').click()
      cy.url().should('include', '/auth/login')
    })
  })

  describe('Authenticated User Dashboard', () => {
    it('should redirect unauthenticated users to login', () => {
      // Visit dashboard directly without authentication
      cy.visit('/dashboard')
      
      // Should redirect to login or show login page
      cy.url().should('satisfy', (url) => {
        return url.includes('/auth/login') || url.includes('/landing')
      })
    })

    it('should show meal sections for authenticated users', () => {
      // This test would require actual authentication
      // For now, we'll test the structure when visiting as guest
      cy.visit('/')
      
      // Note: This test would be enhanced with actual login functionality
      // when authentication system is fully set up with test data
    })
  })

  describe('Food Details Page', () => {
    beforeEach(() => {
      cy.visit('/')
      cy.get('[data-testid="guest-mode-button"]').click()
    })

    it('should display comprehensive nutrition information', () => {
      // Search and navigate to food details
      cy.get('input[placeholder*="Search for foods"]').type('apple')
      cy.get('[data-testid="food-item"]', { timeout: 10000 }).first().click()
      
      // Should show nutrition facts
      cy.get('[data-testid="nutrient-info"]').should('be.visible')
      
      // Should show key nutrients
      cy.get('body').should('contain.text', 'Calories')
      cy.get('body').should('contain.text', 'Protein')
      cy.get('body').should('contain.text', 'Carbohydrates')
      cy.get('body').should('contain.text', 'Fat')
    })

    it('should handle invalid food ID gracefully', () => {
      // Visit non-existent food details page
      cy.visit('/food-details/invalid-food-id', { failOnStatusCode: false })
      
      // Should show error page or redirect
      cy.get('body').should('satisfy', (body) => {
        const text = body.text().toLowerCase()
        return text.includes('not found') || text.includes('error')
      })
    })

    it('should allow navigation back to dashboard', () => {
      // Navigate to food details
      cy.get('input[placeholder*="Search for foods"]').type('orange')
      cy.get('[data-testid="food-item"]', { timeout: 10000 }).first().click()
      
      // Should have way to go back
      cy.get('body').then(($body) => {
        if ($body.find('button:contains("Back")').length > 0) {
          cy.get('button').contains('Back').click()
        } else {
          // Alternative: browser back should work
          cy.go('back')
        }
        cy.url().should('include', '/dashboard')
      })
    })
  })
})
