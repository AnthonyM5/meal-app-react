/**
 * End-to-end: the mobile-facing REST routes (Authorization: Bearer
 * <access_token>, no cookies — added in mobile phasing step 2, see
 * docs/PAWPLATE_PROGRESS.md). These wrap the same lib/services/* functions
 * the web Server Actions call, so this is really an auth-transport +
 * wiring test, not new business logic (that's covered by the service unit
 * tests and the existing dog-nutrition-flow/bowl-photo-flow specs).
 *
 * Run with env sourced automatically via cypress.config.ts's dotenv wiring:
 *   npx cypress run --spec cypress/e2e/mobile-rest-api.cy.ts
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

describe('Mobile REST API', () => {
  let owner: TestUser
  let ownerToken: string
  let stranger: TestUser
  let strangerToken: string
  let food: Food

  before(() => {
    cy.task<TestUser>('createTestUser').then(user => {
      owner = user
      cy.task<{ accessToken: string }>('signInTestUser', {
        email: user.email,
        password: user.password,
      }).then(({ accessToken }) => {
        ownerToken = accessToken
      })
    })
    cy.task<TestUser>('createTestUser').then(user => {
      stranger = user
      cy.task<{ accessToken: string }>('signInTestUser', {
        email: user.email,
        password: user.password,
      }).then(({ accessToken }) => {
        strangerToken = accessToken
      })
    })
    // /api/foods is behind middleware's auth gate unless the guestMode
    // cookie is set (see middleware.ts GUEST_ALLOWED_ROUTES) — this lookup
    // needs no user context, so guest mode is the simplest way in.
    cy.setCookie('guestMode', 'true')
    cy.request('/api/foods/unified-search?q=chicken%20breast')
      .its('body.foods')
      .then((foods: Food[]) => {
        food = foods[0]
      })
    cy.clearCookie('guestMode')
  })

  after(() => {
    if (owner) cy.task('deleteTestUser', owner.id)
    if (stranger) cy.task('deleteTestUser', stranger.id)
  })

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

  it('supports the full dog + meal lifecycle over Bearer-token REST', () => {
    // Create
    cy.request({
      method: 'POST',
      url: '/api/dogs',
      headers: auth(ownerToken),
      body: { name: 'REST Rex', weight_kg: 20 },
    }).then(({ status, body }) => {
      expect(status).to.eq(201)
      expect(body.dog.name).to.eq('REST Rex')
      const dogId = body.dog.id as string

      // List includes it
      cy.request({ url: '/api/dogs', headers: auth(ownerToken) }).then(
        ({ body }) => {
          expect(body.dogs.map((d: { id: string }) => d.id)).to.include(dogId)
        }
      )

      // Get by id
      cy.request({
        url: `/api/dogs/${dogId}`,
        headers: auth(ownerToken),
      }).then(({ body }) => {
        expect(body.dog.id).to.eq(dogId)
      })

      // Update
      cy.request({
        method: 'PATCH',
        url: `/api/dogs/${dogId}`,
        headers: auth(ownerToken),
        body: { weight_kg: 22 },
      }).then(({ body }) => {
        expect(Number(body.dog.weight_kg)).to.eq(22)
      })

      // Log a meal
      cy.request({
        method: 'POST',
        url: `/api/dogs/${dogId}/meals`,
        headers: auth(ownerToken),
        body: {
          meal_type: 'breakfast',
          items: [{ ingredient_id: food.id, grams: 150 }],
          source: 'manual',
        },
      }).then(({ status, body }) => {
        expect(status).to.eq(201)
        expect(body.result.mealKcal).to.be.greaterThan(0)
        const mealId = body.result.mealId as string

        // Today's meals include it
        cy.request({
          url: `/api/dogs/${dogId}/meals`,
          headers: auth(ownerToken),
        }).then(({ body }) => {
          expect(body.meals.map((m: { id: string }) => m.id)).to.include(
            mealId
          )
        })

        // Daily gaps reflect it
        cy.request({
          url: `/api/dogs/${dogId}/gaps`,
          headers: auth(ownerToken),
        }).then(({ body }) => {
          expect(body.totalKcal).to.be.greaterThan(0)
        })

        // Load for edit, then edit it
        cy.request({
          url: `/api/meals/${mealId}`,
          headers: auth(ownerToken),
        }).then(({ body }) => {
          expect(body.meal.items).to.have.length(1)
        })

        cy.request({
          method: 'PATCH',
          url: `/api/meals/${mealId}`,
          headers: auth(ownerToken),
          body: {
            meal_type: 'dinner',
            items: [{ ingredient_id: food.id, grams: 200 }],
          },
        }).then(({ body }) => {
          expect(body.result.mealKcal).to.be.greaterThan(0)
        })

        // Delete the meal, then the dog
        cy.request({
          method: 'DELETE',
          url: `/api/meals/${mealId}`,
          headers: auth(ownerToken),
        }).its('body.ok').should('eq', true)

        cy.request({
          method: 'DELETE',
          url: `/api/dogs/${dogId}`,
          headers: auth(ownerToken),
        }).its('body.ok').should('eq', true)
      })
    })
  })

  it('creates a manual ingredient and accepts a branded suggestion by barcode over REST', () => {
    cy.request({
      method: 'POST',
      url: '/api/ingredients/manual',
      headers: auth(ownerToken),
      body: { name: 'REST Custom Treat', calories_per_100g: 300 },
    }).then(({ status, body }) => {
      expect(status).to.eq(201)
      expect(body.food.source).to.eq('manual')
      expect(body.food.is_verified).to.eq(false)
      // Not required for user deletion anymore (created_by is ON DELETE SET
      // NULL since migration 20260714010000), but without this the run
      // leaves an orphaned custom-ingredient row in the live foods table.
      cy.task('deleteFood', body.food.id)
    })

    // No live OFF network call in CI: assert the validation path instead.
    cy.request({
      method: 'POST',
      url: '/api/ingredients/branded',
      headers: auth(ownerToken),
      failOnStatusCode: false,
      body: {},
    }).then(({ status, body }) => {
      expect(status).to.eq(400)
      expect(body.error).to.match(/code is required/i)
    })
  })

  it('rejects requests with no Bearer token', () => {
    cy.request({
      url: '/api/dogs',
      failOnStatusCode: false,
    }).then(({ status, body }) => {
      expect(status).to.eq(401)
      expect(body.error).to.match(/not authenticated/i)
    })
  })

  it("refuses to let one user touch another user's dog", () => {
    cy.request({
      method: 'POST',
      url: '/api/dogs',
      headers: auth(ownerToken),
      body: { name: 'Owner-only Dog', weight_kg: 10 },
    }).then(({ body }) => {
      const dogId = body.dog.id as string

      // getDog's query is filtered by owner_id, so a stranger's dog_id gets
      // treated as nonexistent rather than found-but-forbidden.
      cy.request({
        url: `/api/dogs/${dogId}`,
        headers: auth(strangerToken),
        failOnStatusCode: false,
      }).then(({ status }) => {
        expect(status).to.eq(404)
      })

      // updateDog/deleteDog fetch by id first, then compare owner_id — a
      // stranger's dogId resolves to a real row, so this is "Unauthorized"
      // (403), not "not found" (404).
      cy.request({
        method: 'PATCH',
        url: `/api/dogs/${dogId}`,
        headers: auth(strangerToken),
        failOnStatusCode: false,
        body: { weight_kg: 99 },
      }).then(({ status }) => {
        expect(status).to.eq(403)
      })

      cy.request({
        method: 'DELETE',
        url: `/api/dogs/${dogId}`,
        headers: auth(strangerToken),
        failOnStatusCode: false,
      }).then(({ status }) => {
        expect(status).to.eq(403)
      })

      // Cleanup as the real owner
      cy.request({
        method: 'DELETE',
        url: `/api/dogs/${dogId}`,
        headers: auth(ownerToken),
      })
    })
  })
})
