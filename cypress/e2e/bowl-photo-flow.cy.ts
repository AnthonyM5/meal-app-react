/**
 * End-to-end: bowl photo → confirmation → meal logged with source 'photo'.
 *
 * The Gemini call is stubbed via cy.intercept, so this spec is deterministic
 * and costs nothing. The confirmation step still runs the *real*
 * `createDogMeal` server action, so the meal genuinely lands in the database.
 *
 * The two authorization tests hit the real route. The dog-ownership check runs
 * before the vision call, so they never reach Gemini either.
 *
 * Run with env sourced from .env.local:
 *   set -a && source .env.local && set +a && npx cypress run --spec cypress/e2e/bowl-photo-flow.cy.ts
 */

interface TestUser {
  email: string
  password: string
  id: string
}

interface Food {
  id: string
  name: string
}

describe('Bowl photo flow', () => {
  let owner: TestUser
  let stranger: TestUser
  let strangerDogId: string
  let dogId: string

  before(() => {
    cy.task<TestUser>('createTestUser').then(user => {
      owner = user
    })
    // A second user with a dog the owner must never be able to touch
    cy.task<TestUser>('createTestUser').then(user => {
      stranger = user
      cy.task<string>('createDogForUser', {
        userId: user.id,
        name: 'Stranger Dog',
      }).then(dogId => {
        strangerDogId = dogId
      })
    })
  })

  after(() => {
    if (owner) cy.task('deleteTestUser', owner.id)
    if (stranger) cy.task('deleteTestUser', stranger.id)
  })

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  it('analyzes a photo, lets the owner confirm grams, and logs the meal as source=photo', () => {
    cy.login(owner.email, owner.password)
    cy.url().should('include', '/dashboard')

    // The owner needs a dog before they can photograph its bowl
    cy.contains('button', 'Add your dog', { timeout: 10000 }).click()
    cy.get('#dog-name').type('Cypress Scout')
    cy.get('#dog-weight').type('18')
    cy.contains('button', /^Add dog$/).click()
    cy.contains("Cypress Scout's day", { timeout: 10000 }).should('be.visible')

    // Grab a real seeded ingredient to build a believable stubbed analysis
    cy.request('/api/foods/unified-search?q=chicken%20breast')
      .its('body.foods')
      .should('have.length.greaterThan', 0)
      .then((foods: Food[]) => {
        const food = foods[0]

        cy.intercept('POST', '/api/bowl/analyze', {
          statusCode: 200,
          body: {
            analysis_id: '00000000-0000-4000-8000-000000000abc',
            image_url: '/icon-192.png',
            notes: 'Possible leafy green, could not distinguish spinach vs kale.',
            items: [
              {
                label: 'chicken breast',
                estimated_proportion: 0.7,
                confidence: 0.92,
                normalized_ingredient_id: food.id,
                ingredient: food,
              },
              {
                label: 'mystery green',
                estimated_proportion: 0.3,
                confidence: 0.41,
                normalized_ingredient_id: null,
                ingredient: null,
              },
            ],
          },
        }).as('analyze')

        cy.intercept('PATCH', '/api/bowl/analyze', {
          statusCode: 200,
          body: { ok: true },
        }).as('saveCorrections')

        cy.contains('a', 'Log from photo').click()
        cy.url()
          .should('include', '/bowl')
          .then(url => {
            // The dashboard link carries ?dog=<id> — capture it so we can
            // assert the persisted meal below.
            dogId = new URL(url).searchParams.get('dog') as string
            expect(dogId).to.be.a('string').and.not.be.empty
          })

        // An owner note rides along with the upload to guide identification
        cy.get('#bowl-hint').type('the protein is chicken breast')

        // The hidden input is driven by the visible "Take or choose a photo" button
        cy.get('[data-testid="bowl-photo-input"]').selectFile(
          'cypress/fixtures/bowl.png',
          { force: true }
        )
        cy.wait('@analyze').then(({ request }) => {
          // Multipart body arrives as an ArrayBuffer — decode to assert the
          // hint field was actually sent.
          const raw =
            typeof request.body === 'string'
              ? request.body
              : new TextDecoder().decode(request.body)
          expect(raw).to.contain('name="hint"')
          expect(raw).to.contain('the protein is chicken breast')
        })

        cy.contains('Confirm this bowl', { timeout: 10000 }).should('be.visible')

        // Proportions must be shown as percentages, never as grams
        cy.contains('~70% of bowl').should('be.visible')
        cy.contains('92% confident').should('be.visible')

        // The unmatched item blocks submission until it's resolved
        cy.contains('no match').should('be.visible')
        cy.contains('button', /Log breakfast from photo/i).click()
        cy.contains(/Resolve every item/i).should('be.visible')

        // Drop the unmatched row, fill in real grams for the matched one
        cy.get('button[aria-label="Remove mystery green"]').click()
        cy.get('[data-testid="bowl-items"] li').should('have.length', 1)
        cy.get('input[aria-label^="Grams of"]').clear().type('160')

        cy.contains('button', /Log breakfast from photo/i).click()

        // Corrections are persisted — the eval signal for Phase 6
        cy.wait('@saveCorrections')
          .its('request.body')
          .then(body => {
            expect(body.analysis_id).to.eq('00000000-0000-4000-8000-000000000abc')
            expect(body.corrected_items).to.have.length(1)
            expect(body.corrected_items[0].ingredient_id).to.eq(food.id)
          })

        // Lands back on the dashboard with the meal visible
        cy.url({ timeout: 10000 }).should('include', '/dashboard')
        cy.contains("Today's meals", { timeout: 10000 }).should('be.visible')
        cy.contains(/breakfast · \d+ kcal/i).should('be.visible')
      })

    // The meal is persisted with source 'photo', not 'manual'
    cy.then(() => {
      cy.task<{ source: string; meal_type: string } | null>(
        'getLatestMealForDog',
        dogId
      ).then(meal => {
        expect(meal, 'a meal was persisted').to.not.be.null
        expect(meal!.source).to.eq('photo')
        expect(meal!.meal_type).to.eq('breakfast')
      })
    })
  })

  it('re-analyzes the same photo when the owner adds a corrective note', () => {
    cy.login(owner.email, owner.password)
    cy.url().should('include', '/dashboard')

    // Reuse the dog created in the first test; grab a real ingredient for
    // believable stubbed matches.
    cy.request('/api/foods/unified-search?q=chicken%20breast')
      .its('body.foods')
      .should('have.length.greaterThan', 0)
      .then((foods: Food[]) => {
        const food = foods[0]
        const analysisId = '00000000-0000-4000-8000-000000000def'

        // First pass: the model only sees macaroni — the meats are submerged.
        cy.intercept('POST', '/api/bowl/analyze', {
          statusCode: 200,
          body: {
            analysis_id: analysisId,
            image_url: '/icon-192.png',
            notes: '',
            items: [
              {
                label: 'macaroni',
                estimated_proportion: 1,
                confidence: 0.9,
                normalized_ingredient_id: food.id,
                ingredient: food,
              },
            ],
          },
        }).as('analyze')

        cy.visit('/bowl')
        cy.get('[data-testid="bowl-photo-input"]').selectFile(
          'cypress/fixtures/bowl.png',
          { force: true }
        )
        cy.wait('@analyze')
        cy.contains('Confirm this bowl', { timeout: 10000 }).should('be.visible')
        cy.get('[data-testid="bowl-items"] li').should('have.length', 1)

        // Second pass: registered after the first so it takes precedence.
        // The hint surfaces the missed item.
        cy.intercept('POST', '/api/bowl/analyze', {
          statusCode: 200,
          body: {
            analysis_id: analysisId,
            image_url: '/icon-192.png',
            notes: 'Included ground beef per the owner note.',
            items: [
              {
                label: 'macaroni',
                estimated_proportion: 0.6,
                confidence: 0.9,
                normalized_ingredient_id: food.id,
                ingredient: food,
              },
              {
                label: 'ground beef',
                estimated_proportion: 0.4,
                confidence: 0.5,
                normalized_ingredient_id: null,
                ingredient: null,
              },
            ],
          },
        }).as('reanalyze')

        cy.get('textarea[aria-label="Note for re-analysis"]').type(
          'there is also ground beef mixed in'
        )
        cy.contains('button', /Re-analyze with this note/i).click()

        cy.wait('@reanalyze').then(({ request }) => {
          const raw =
            typeof request.body === 'string'
              ? request.body
              : new TextDecoder().decode(request.body)
          expect(raw).to.contain('name="analysis_id"')
          expect(raw).to.contain(analysisId)
          expect(raw).to.contain('there is also ground beef mixed in')
        })

        // The confirmation remounts with the model's revised item list
        cy.get('[data-testid="bowl-items"] li', { timeout: 10000 }).should(
          'have.length',
          2
        )
        cy.contains('ground beef').should('be.visible')
      })
  })

  it("refuses to re-analyze an analysis the caller doesn't own", () => {
    cy.login(owner.email, owner.password)
    cy.url().should('include', '/dashboard')

    cy.window().then(async win => {
      const form = new win.FormData()
      form.append('analysis_id', '00000000-0000-4000-8000-000000000abc')
      form.append('hint', 'there is also ground beef')

      const response = await win.fetch('/api/bowl/analyze', {
        method: 'POST',
        body: form,
      })
      const body = await response.json()

      expect(response.status).to.eq(404)
      expect(body.error).to.match(/not found/i)
    })
  })

  it("refuses to analyze another user's dog", () => {
    cy.login(owner.email, owner.password)
    cy.url().should('include', '/dashboard')

    // Issue the request from the browser so it carries the real session
    // cookies and a genuine multipart FormData body.
    cy.window().then(async win => {
      const form = new win.FormData()
      form.append('dog_id', strangerDogId)

      const response = await win.fetch('/api/bowl/analyze', {
        method: 'POST',
        body: form,
      })
      const body = await response.json()

      // Ownership is checked before the upload is read or the model is called,
      // so this never reaches Gemini.
      expect(response.status).to.eq(404)
      expect(body.error).to.match(/not found/i)
    })
  })

  it('rejects a bowl analysis with no dog_id', () => {
    cy.login(owner.email, owner.password)
    cy.url().should('include', '/dashboard')

    cy.window().then(async win => {
      const form = new win.FormData()

      const response = await win.fetch('/api/bowl/analyze', {
        method: 'POST',
        body: form,
      })
      const body = await response.json()

      expect(response.status).to.eq(400)
      expect(body.error).to.match(/dog_id is required/i)
    })
  })

  it("refuses to overwrite an analysis the caller doesn't own", () => {
    cy.login(owner.email, owner.password)
    cy.url().should('include', '/dashboard')

    cy.window().then(async win => {
      const response = await win.fetch('/api/bowl/analyze', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_id: '00000000-0000-4000-8000-000000000abc',
          corrected_items: [],
        }),
      })
      expect(response.status).to.eq(404)
    })
  })
})
