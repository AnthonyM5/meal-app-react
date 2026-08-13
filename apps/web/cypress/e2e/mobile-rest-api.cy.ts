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
    // The food catalog is global, not user-scoped, so this lookup needs no
    // credentials at all: middleware exempts the read-only /api/foods/ subtree
    // via isBearerFoodRead(). No guestMode cookie required.
    //
    // (This previously set and cleared a guestMode cookie, on the belief that
    // GUEST_ALLOWED_ROUTES was what let /api/foods through. It wasn't — the
    // isBearerFoodRead branch matches first and returns before the guest list
    // is consulted. The '/api/foods' entry in GUEST_ALLOWED_ROUTES has since
    // been removed, because its only unique effect was exposing the
    // now-deleted POST /api/foods/import-external to unauthenticated callers.)
    cy.request('/api/foods/unified-search?q=chicken%20breast')
      .its('body.foods')
      .then((foods: Food[]) => {
        food = foods[0]
      })
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

  it('ranks search results by relevance, not alphabetically', () => {
    // Regression guard for the bug fixed in migration 20260729000100. The
    // previous scoring used word_similarity(), which returns 1.0 for anything
    // containing the query as a word — at 5,029 USDA rows that saturated every
    // score, so ordering silently collapsed to alphabetical `name`. "beef"
    // returned "Beans, baked, canned, with beef" and "rice" returned
    // "Noodles, chinese, cellophane or long rice" above any actual rice.
    //
    // Deeper relevance coverage (18 named cases + MATCH_THRESHOLD separation)
    // lives in scripts/023_search_relevance_check.ts, which can run against a
    // populated database outside CI.
    cy.request({
      url: '/api/ingredients/search?q=beef',
      headers: auth(ownerToken),
    }).then(({ body }) => {
      expect(body.foods).to.be.an('array').and.not.be.empty
      expect(body.foods[0].name).to.match(/^beef[,\s]/i)
      // Scores must spread out, not all pin to 1.00.
      expect(body.foods[0].similarity).to.be.lessThan(1)
    })

    cy.request({
      url: '/api/ingredients/search?q=rice',
      headers: auth(ownerToken),
    }).then(({ body }) => {
      expect(body.foods[0].name).to.match(/^rice[,\s]/i)
    })
  })

  it('returns canonical groups from grouped search', () => {
    // The canonical layer collapses ~960 "Beef, ..." variant rows onto ~43
    // groups. Skips cleanly when scripts/026 has not been run against this
    // database yet, so the spec is safe on a freshly seeded environment.
    cy.request({
      url: '/api/ingredients/grouped-search?q=beef',
      headers: auth(ownerToken),
    }).then(({ status, body }) => {
      expect(status).to.eq(200)
      expect(body.groups).to.be.an('array')
      if (body.groups.length === 0) {
        cy.log('canonical layer not built in this database — skipping assertions')
        return
      }
      const group = body.groups[0]
      expect(group.display_name).to.match(/beef/i)
      expect(group.slug).to.match(/^beef/)
      expect(group.variant_count).to.be.at.least(1)
      // The default variant's nutrition rides along, so the picker needs no
      // second round trip to render a group.
      expect(group.food_id).to.be.a('string')
      expect(group.calories_per_serving).to.be.a('number')

      // Expanding a group lists its variants, default first.
      cy.request({
        url: `/api/ingredients/grouped-search?canonical_id=${group.canonical_id}`,
        headers: auth(ownerToken),
      }).then(({ body: expanded }) => {
        expect(expanded.variants).to.be.an('array').and.not.be.empty
        expect(expanded.variants[0].is_canonical_default).to.eq(true)
      })
    })

    // Sub-2-char queries return an empty group list, mirroring flat search.
    cy.request({
      url: '/api/ingredients/grouped-search?q=a',
      headers: auth(ownerToken),
    }).then(({ body }) => {
      expect(body.groups).to.deep.eq([])
    })

    cy.request({
      url: '/api/ingredients/grouped-search?q=beef',
      failOnStatusCode: false,
    }).then(({ status }) => {
      expect(status).to.eq(401)
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

  // Security regression guard, against a real running server.
  //
  // These two routes performed service-role writes to the shared `foods` table
  // with no auth check of their own. /api/foods/import-external was reachable
  // by ANY unauthenticated caller: middleware prefix-matched '/api/foods' in
  // GUEST_ALLOWED_ROUTES, so setting the client-side `guestMode` cookie on
  // yourself was enough to POST to it. Both are deleted — imports are
  // script-only now (see docs/api-integration.md).
  //
  // __tests__/middleware.test.ts pins the middleware lists in isolation; this
  // asserts the deployed surface, including with the cookie that used to be
  // the way in. Anything other than 404/405 means an import endpoint is back.
  // The two paths fail differently, and both are acceptable:
  //   /api/foods/import-external  -> passes the gate (isBearerFoodRead exempts
  //                                  the whole read-only /api/foods/ subtree),
  //                                  then 404s because the route is gone.
  //   /api/ingredients/import     -> never reaches routing at all; it is not
  //                                  enumerated in BEARER_AUTH_ROUTES, so the
  //                                  cookie gate 307s it to /auth/login.
  // followRedirect:false is required — otherwise Cypress chases that 307 to
  // the login page and reports a perfectly healthy 200.
  it('does not expose HTTP import endpoints', () => {
    cy.setCookie('guestMode', 'true')
    for (const url of ['/api/foods/import-external', '/api/ingredients/import']) {
      cy.request({
        method: 'POST',
        url,
        body: { query: 'chicken' },
        failOnStatusCode: false,
        followRedirect: false,
      }).then(({ status, body }) => {
        expect(status, `${url} must not accept writes`).to.be.oneOf([
          307, 404, 405,
        ])
        // Whatever the status, nothing may look like an import result.
        expect(body ?? {}).to.not.have.property('imported')
      })
    }
    cy.clearCookie('guestMode')
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

  it('authenticates the bowl-analyze route by Bearer token (mobile photo flow)', () => {
    // /api/bowl/analyze authenticated cookie-only until mobile phasing step
    // 4b; it now also accepts a Bearer token (getAuthenticatedUserId) and is
    // in middleware's BEARER_AUTH_ROUTES. These assertions prove the token
    // resolves the caller WITHOUT reaching Gemini: handleOwnerScan checks
    // dog_id (400) then ownership (404) before it ever reads the image or
    // calls the model. `form: true` sends a urlencoded body that the route's
    // request.formData() parses like the native multipart upload.

    // A Bearer caller with no dog_id lands on the owner path (400), not the
    // guest path — proof the token authenticated the request.
    cy.request({
      method: 'POST',
      url: '/api/bowl/analyze',
      headers: auth(ownerToken),
      form: true,
      body: { hint: 'the protein is chicken breast' },
      failOnStatusCode: false,
    }).then(({ status, body }) => {
      expect(status).to.eq(400)
      expect(body.error).to.match(/dog_id is required/i)
    })

    // A Bearer caller passing a dog they don't own gets 404 — the ownership
    // check ran against the Bearer-resolved user.
    cy.task<string>('createDogForUser', {
      userId: stranger.id,
      name: 'Bowl Stranger Dog',
    }).then(strangerDogId => {
      cy.request({
        method: 'POST',
        url: '/api/bowl/analyze',
        headers: auth(ownerToken),
        form: true,
        body: { dog_id: strangerDogId },
        failOnStatusCode: false,
      }).then(({ status, body }) => {
        expect(status).to.eq(404)
        expect(body.error).to.match(/not found/i)
      })
    })
  })
})
