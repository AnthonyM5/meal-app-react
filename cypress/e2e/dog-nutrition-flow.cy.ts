/**
 * End-to-end: sign in → add a dog → log a meal → view nutrient gaps.
 *
 * Requires a real Supabase project: the createTestUser task uses the
 * service-role admin API, so run with env sourced from .env.local:
 *   set -a && source .env.local && set +a && npm run test:e2e:headless
 */

interface TestUser {
  email: string
  password: string
  id: string
}

describe('Dog nutrition flow', () => {
  let user: TestUser

  before(() => {
    cy.task<TestUser>('createTestUser').then(created => {
      user = created
    })
  })

  after(() => {
    if (user) {
      cy.task('deleteTestUser', user.id)
    }
  })

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  it('adds a dog, logs a meal, and shows nutrient coverage', () => {
    cy.login(user.email, user.password)
    cy.url().should('include', '/dashboard')

    // No dogs yet → onboarding card with add-dog CTA
    cy.contains('button', 'Add your dog', { timeout: 10000 }).click()

    // Fill the dog form (defaults: adult, moderately active, neutered)
    cy.get('#dog-name').type('Cypress Rex')
    cy.get('#dog-weight').type('20')
    cy.contains('button', 'Add dog').click()

    // Dashboard reloads with the dog selected and a kcal target
    cy.contains("Cypress Rex's day", { timeout: 10000 }).should('be.visible')
    cy.contains(/of \d+ kcal target/).should('be.visible')

    // Log a meal: search a seeded ingredient and set grams
    cy.get('input[placeholder*="Search ingredients"]').type('chicken breast')
    cy.contains('button', /chicken breast/i, { timeout: 10000 }).click()

    cy.get('input[aria-label^="Grams of"]').clear().type('150')
    cy.contains('button', /^Log breakfast$/).click()

    // Logged meal appears with kcal
    cy.contains("Today's meals", { timeout: 10000 }).should('be.visible')
    cy.contains(/breakfast · \d+ kcal/i).should('be.visible')

    // Nutrient coverage shows real gap rows with statuses
    cy.contains('Nutrient coverage').should('be.visible')
    cy.contains('Protein').should('be.visible')
    cy.contains('Calcium').should('be.visible')
    cy.get('body').then($body => {
      // At least one status badge is rendered
      expect(
        $body.text().match(/On target|Low|High|Over safe limit|Info only/)
      ).to.not.be.null
    })

    // Dog management page lists the dog
    cy.contains('a', 'Manage dogs').click()
    cy.url().should('include', '/dogs')
    cy.contains('Cypress Rex').should('be.visible')
    cy.contains(/kcal\/day/).should('be.visible')
  })

  it('keeps guest mode working on /dogs and /dashboard', () => {
    // Middleware reads the cookie from the request, so set it before visiting
    cy.setCookie('guestMode', 'true')

    cy.visit('/dashboard')
    cy.contains(/guest mode/i, { timeout: 10000 }).should('be.visible')

    cy.visit('/dogs')
    cy.contains(/sign in to add your dogs/i).should('be.visible')
  })
})
