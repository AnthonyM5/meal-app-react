describe('Error Handling and Edge Cases', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  describe('Network and API Error Handling', () => {
    it('should handle search API failures gracefully', () => {
      cy.useGuestMode()
      
      // Intercept API calls and make them fail
      cy.intercept('GET', '**/api/**', { forceNetworkError: true }).as('apiFailure')
      
      cy.searchFood('apple')
      
      // Should handle error gracefully
      cy.get('body').should('satisfy', (body) => {
        const text = body.text().toLowerCase()
        return text.includes('error') || text.includes('failed') || text.includes('try again')
      })
    })

    it('should handle slow API responses', () => {
      cy.useGuestMode()
      
      // Intercept API and delay response
      cy.intercept('GET', '**/api/**', (req) => {
        req.reply({
          delay: 3000,
          statusCode: 200,
          body: []
        })
      }).as('slowApi')
      
      cy.searchFood('banana')
      
      // Should show loading state
      cy.get('body').should('satisfy', (body) => {
        const text = body.text().toLowerCase()
        return text.includes('loading') || text.includes('searching')
      })
      
      // Should eventually show results or timeout gracefully
      cy.wait('@slowApi', { timeout: 5000 })
    })
  })

  describe('Navigation and URL Handling', () => {
    it('should handle direct navigation to protected routes', () => {
      // Try to access dashboard directly without authentication
      cy.visit('/dashboard')
      
      // Should redirect to login or show landing
      cy.url().should('satisfy', (url) => {
        return url.includes('/auth/login') || url.includes('/landing') || url === Cypress.config().baseUrl + '/'
      })
    })

    it('should handle invalid food detail URLs', () => {
      cy.visit('/food-details/nonexistent-food-id', { failOnStatusCode: false })
      
      // Should show error or redirect
      cy.get('body').should('satisfy', (body) => {
        const text = body.text().toLowerCase()
        return text.includes('not found') || text.includes('error') || text.includes('invalid')
      })
    })

    it('should handle browser back button correctly', () => {
      cy.useGuestMode()
      cy.searchFood('orange')
      cy.waitForSearchResults()
      
      // Navigate to food details
      cy.get('[data-testid="food-item"]').first().click()
      cy.url().should('include', '/food-details/')
      
      // Go back
      cy.go('back')
      cy.url().should('include', '/dashboard')
      
      // Should preserve search state
      cy.get('input[placeholder*="Search for foods"]').should('have.value', 'orange')
    })
  })

  describe('Input Validation and Security', () => {
    it('should handle special characters in search', () => {
      cy.useGuestMode()
      
      const specialChars = ['<script>', '&lt;script&gt;', '"', "'", '%', '\\']
      
      specialChars.forEach(char => {
        cy.searchFood(char)
        
        // Should not break the page
        cy.get('input[placeholder*="Search for foods"]').should('be.visible')
        
        // Clear for next test
        cy.get('input[placeholder*="Search for foods"]').clear()
      })
    })

    it('should handle very long search queries', () => {
      cy.useGuestMode()
      
      const longQuery = 'a'.repeat(1000)
      cy.searchFood(longQuery)
      
      // Should not break the page
      cy.get('input[placeholder*="Search for foods"]').should('be.visible')
    })

    it('should handle rapid consecutive searches', () => {
      cy.useGuestMode()
      
      // Perform multiple rapid searches
      const searches = ['apple', 'banana', 'orange', 'grape', 'kiwi']
      
      searches.forEach(search => {
        cy.searchFood(search)
        cy.wait(100) // Small delay between searches
      })
      
      // Should handle gracefully without errors
      cy.get('input[placeholder*="Search for foods"]').should('be.visible')
    })
  })

  describe('Accessibility and Usability', () => {
    it('should be keyboard navigable', () => {
      cy.useGuestMode()
      
      // Tab through main elements
      cy.get('body').type('{tab}')
      cy.focused().should('be.visible')
      
      // Should be able to reach search input
      cy.get('input[placeholder*="Search for foods"]').focus()
      cy.focused().should('have.attr', 'placeholder')
    })

    it('should handle focus management correctly', () => {
      cy.useGuestMode()
      
      // Focus search input
      cy.get('input[placeholder*="Search for foods"]').focus().type('apple')
      
      // Search results should not steal focus inappropriately
      cy.focused().should('contain.value', 'apple')
    })

    it('should provide proper ARIA labels and roles', () => {
      cy.useGuestMode()
      
      // Check for accessibility attributes
      cy.get('input[placeholder*="Search for foods"]')
        .should('have.attr', 'type', 'text')
        .and('be.visible')
      
      // Buttons should have proper labels
      cy.get('button').each(($btn) => {
        cy.wrap($btn).should('satisfy', (btn) => {
          return btn.text().trim() !== '' || btn.attr('aria-label') || btn.attr('title')
        })
      })
    })
  })

  describe('Performance and Memory', () => {
    it('should handle multiple page navigations without memory leaks', () => {
      // Navigate through multiple pages
      for (let i = 0; i < 5; i++) {
        cy.visit('/')
        cy.get('[data-testid="guest-mode-button"]').click()
        cy.get('a[href="/auth/login"]').click()
        cy.visit('/')
      }
      
      // Should still be responsive
      cy.get('[data-testid="guest-mode-button"]').should('be.visible')
    })

    it('should handle large search result sets', () => {
      cy.useGuestMode()
      
      // Search for common term that might return many results
      cy.searchFood('a')
      
      // Should render without performance issues
      cy.get('[data-testid="food-item"]', { timeout: 10000 })
        .should('exist')
        .and('have.length.at.most', 50) // Assuming pagination or limiting
    })
  })
})
