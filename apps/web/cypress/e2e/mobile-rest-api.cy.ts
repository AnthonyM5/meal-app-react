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

  it('searches ingredients over Bearer-token REST (mobile meal builder)', () => {
    // Same fuzzy_search_foods RPC as /api/foods/unified-search, but behind
    // Bearer auth (added in mobile phasing step 4 for apps/mobile).
    cy.request({
      url: '/api/ingredients/search?q=chicken%20breast',
      headers: auth(ownerToken),
    }).then(({ status, body }) => {
      expect(status).to.eq(200)
      expect(body.foods).to.be.an('array').and.not.be.empty
      expect(body.foods[0].name).to.match(/chicken/i)
    })

    // Sub-2-char queries return an empty list, mirroring unified-search.
    cy.request({
      url: '/api/ingredients/search?q=a',
      headers: auth(ownerToken),
    }).then(({ body }) => {
      expect(body.foods).to.deep.eq([])
    })

    // Unlike unified-search, no token means 401 JSON — not an HTML redirect.
    cy.request({
      url: '/api/ingredients/search?q=chicken',
      failOnStatusCode: false,
    }).then(({ status, body }) => {
      expect(status).to.eq(401)
      expect(body.error).to.match(/not authenticated/i)
    })
  })

  it('answers CORS preflight for the native WebView origins', () => {
    // The Capacitor shell calls from capacitor://localhost (iOS) /
    // https://localhost (Android); the Authorization header forces a
    // preflight, which middleware answers (route handlers have no OPTIONS).
    cy.request({
      method: 'OPTIONS',
      url: '/api/dogs',
      headers: {
        Origin: 'capacitor://localhost',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization',
      },
    }).then(({ status, headers }) => {
      expect(status).to.eq(204)
      expect(headers['access-control-allow-origin']).to.eq('*')
      expect(headers['access-control-allow-headers']).to.match(/authorization/i)
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

      // Every foreign-resource access returns 404 (not 403) so a non-owner
      // can't confirm the id exists — GET, PATCH, DELETE, and gaps all agree.
      const foreign = (
        method: string,
        url: string,
        reqBody?: Record<string, unknown>
      ) =>
        cy
          .request({
            method,
            url,
            headers: auth(strangerToken),
            failOnStatusCode: false,
            ...(reqBody ? { body: reqBody } : {}),
          })
          .then(({ status }) => {
            expect(status, `${method} ${url}`).to.eq(404)
          })

      foreign('GET', `/api/dogs/${dogId}`)
      foreign('PATCH', `/api/dogs/${dogId}`, { weight_kg: 99 })
      foreign('GET', `/api/dogs/${dogId}/gaps`)
      foreign('GET', `/api/dogs/${dogId}/meals`)
      foreign('POST', `/api/dogs/${dogId}/meals`, {
        meal_type: 'breakfast',
        items: [{ ingredient_id: food.id, grams: 100 }],
      })
      foreign('DELETE', `/api/dogs/${dogId}`)

      // Cleanup as the real owner
      cy.request({
        method: 'DELETE',
        url: `/api/dogs/${dogId}`,
        headers: auth(ownerToken),
      })
    })
  })

  it("refuses to let one user touch another user's meal", () => {
    // Owner creates a dog and logs a meal; the stranger must not reach it
    // through the meal-scoped routes.
    cy.request({
      method: 'POST',
      url: '/api/dogs',
      headers: auth(ownerToken),
      body: { name: 'Meal Owner Dog', weight_kg: 15 },
    }).then(({ body }) => {
      const dogId = body.dog.id as string
      cy.request({
        method: 'POST',
        url: `/api/dogs/${dogId}/meals`,
        headers: auth(ownerToken),
        body: {
          meal_type: 'breakfast',
          items: [{ ingredient_id: food.id, grams: 120 }],
        },
      }).then(({ body }) => {
        const mealId = body.result.mealId as string

        cy.request({
          url: `/api/meals/${mealId}`,
          headers: auth(strangerToken),
          failOnStatusCode: false,
        }).then(({ status }) => expect(status).to.eq(404))

        cy.request({
          method: 'PATCH',
          url: `/api/meals/${mealId}`,
          headers: auth(strangerToken),
          failOnStatusCode: false,
          body: {
            meal_type: 'dinner',
            items: [{ ingredient_id: food.id, grams: 200 }],
          },
        }).then(({ status }) => expect(status).to.eq(404))

        cy.request({
          method: 'DELETE',
          url: `/api/meals/${mealId}`,
          headers: auth(strangerToken),
          failOnStatusCode: false,
        }).then(({ status }) => expect(status).to.eq(404))

        // Cleanup as the real owner
        cy.request({
          method: 'DELETE',
          url: `/api/dogs/${dogId}`,
          headers: auth(ownerToken),
        })
      })
    })
  })

  it('rejects malformed and wrongly-typed request bodies with 400, not 500', () => {
    // Malformed JSON (not an object at all)
    cy.request({
      method: 'POST',
      url: '/api/dogs',
      headers: { ...auth(ownerToken), 'Content-Type': 'application/json' },
      body: 'this is not json{',
      failOnStatusCode: false,
    }).then(({ status, body }) => {
      expect(status).to.eq(400)
      expect(body.error).to.match(/valid json/i)
    })

    // Well-formed JSON, wrong field type: weight_kg as a string would slip
    // past the service's `<= 0` check (NaN compares false) and 500 at Postgres.
    cy.request({
      method: 'POST',
      url: '/api/dogs',
      headers: auth(ownerToken),
      body: { name: 'Bad Type Dog', weight_kg: 'heavy' },
      failOnStatusCode: false,
    }).then(({ status, body }) => {
      expect(status).to.eq(400)
      expect(body.error).to.match(/weight_kg/i)
    })

    // Unknown enum value is also a 400, not a downstream error.
    cy.request({
      method: 'POST',
      url: '/api/dogs',
      headers: auth(ownerToken),
      body: { name: 'Bad Enum Dog', weight_kg: 10, life_stage: 'kitten' },
      failOnStatusCode: false,
    }).then(({ status }) => {
      expect(status).to.eq(400)
    })
  })
})
