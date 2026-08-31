/**
 * Contract test: @pawplate/api-client  ↔  apps/web REST routes.
 *
 * The api-client hand-transcribes request/response shapes and route paths from
 * this app's REST layer (see the header comment in
 * packages/api-client/src/index.ts). Nothing but this test guards against
 * drift: rename a field in rest-schemas.ts, change a response envelope key, or
 * move a route, and BOTH sides still compile — but the mobile app breaks at
 * runtime, silently, in production.
 *
 * This drives every live client method through a recording fake `fetch` and,
 * for each call, asserts three things:
 *   1. method + path (+ query) match the live route,
 *   2. the JSON body the client sends parses *strictly* against the very zod
 *      schema the route uses at its trust boundary (so an extra/renamed field
 *      is a failure, not a silently-dropped key), and
 *   3. the client unwraps the documented response envelope.
 *
 * A final block asserts every path template actually has a route.ts on disk,
 * so deleting or renaming an endpoint fails here too.
 *
 * When you add a client method or a route, add it here. This file is the
 * executable spec of the web↔mobile boundary.
 */
import { describe, expect, it } from '@jest/globals'
import {
  ApiError,
  createPawPlateClient,
  type PawPlateClient,
} from '@pawplate/api-client'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { AnyZodObject } from 'zod'
import {
  BrandedIngredientSchema,
  DogCreateSchema,
  DogUpdateSchema,
  ManualIngredientSchema,
  MealCreateSchema,
  MealUpdateSchema,
} from '@/lib/server/rest-schemas'

interface RecordedRequest {
  method: string
  path: string
  search: string
  headers: Record<string, string>
  /** Parsed JSON body, or a plain object of FormData entries, or undefined. */
  body: Record<string, unknown> | undefined
  isFormData: boolean
}

function makeClient(payload: unknown = {}, ok = true, status = 200) {
  const calls: RecordedRequest[] = []
  const fetchMock = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const raw = init?.body
    const isFormData = typeof FormData !== 'undefined' && raw instanceof FormData
    let body: Record<string, unknown> | undefined
    if (isFormData) {
      body = Object.fromEntries((raw as FormData).entries())
    } else if (typeof raw === 'string') {
      body = JSON.parse(raw)
    }
    // Normalize headers (the client passes a plain object literal) to lowercase.
    const headers: Record<string, string> = {}
    for (const [k, v] of Object.entries(
      (init?.headers as Record<string, string>) ?? {}
    )) {
      headers[k.toLowerCase()] = v
    }
    calls.push({
      method: (init?.method ?? 'GET').toUpperCase(),
      path: url.pathname,
      search: url.search,
      headers,
      body,
      isFormData,
    })
    return { ok, status, json: async () => payload } as unknown as Response
  }) as typeof fetch

  const client: PawPlateClient = createPawPlateClient({
    baseUrl: 'https://pawplate.example',
    getAccessToken: () => 'test-token',
    fetch: fetchMock,
  })
  return { client, calls, last: () => calls[calls.length - 1] }
}

/** Strict parse: fails on a missing required field OR an unknown extra key —
 *  exactly the drift we want to catch between the client input and the route. */
function expectAccepts(schema: AnyZodObject, body: unknown) {
  const result = schema.strict().safeParse(body)
  if (!result.success) {
    throw new Error(
      `Body the client sent does not match the route schema:\n${JSON.stringify(
        result.error.issues,
        null,
        2
      )}\nBody was: ${JSON.stringify(body)}`
    )
  }
}

describe('api-client ↔ REST: request path, verb, and body', () => {
  describe('dogs', () => {
    it('list → GET /api/dogs', async () => {
      const { client, last } = makeClient({ dogs: [] })
      await client.dogs.list()
      expect(last()).toMatchObject({ method: 'GET', path: '/api/dogs' })
    })

    it('get → GET /api/dogs/:id', async () => {
      const { client, last } = makeClient({ dog: {} })
      await client.dogs.get('dog-1')
      expect(last()).toMatchObject({ method: 'GET', path: '/api/dogs/dog-1' })
    })

    it('create → POST /api/dogs with a DogCreateSchema-valid body', async () => {
      const { client, last } = makeClient({ dog: {} })
      await client.dogs.create({
        name: 'Rex',
        breed: 'Labrador',
        weight_kg: 20,
        ideal_weight_kg: 18,
        birth_date: '2020-01-01',
        life_stage: 'adult',
        activity_level: 'moderately_active',
        neutered: true,
        health_conditions: ['none'],
        avatar_url: null,
        bowl_diameter_cm: 15,
      })
      expect(last()).toMatchObject({ method: 'POST', path: '/api/dogs' })
      expectAccepts(DogCreateSchema, last().body)
    })

    it('update → PATCH /api/dogs/:id with a DogUpdateSchema-valid body', async () => {
      const { client, last } = makeClient({ dog: {} })
      await client.dogs.update('dog-1', { weight_kg: 21, neutered: false })
      expect(last()).toMatchObject({ method: 'PATCH', path: '/api/dogs/dog-1' })
      expectAccepts(DogUpdateSchema, last().body)
    })

    it('remove → DELETE /api/dogs/:id', async () => {
      const { client, last } = makeClient({ ok: true })
      await client.dogs.remove('dog-1')
      expect(last()).toMatchObject({ method: 'DELETE', path: '/api/dogs/dog-1' })
    })
  })

  describe('meals', () => {
    it('listForDog → GET /api/dogs/:id/meals?date=', async () => {
      const { client, last } = makeClient({ meals: [] })
      await client.meals.listForDog('dog-1', '2026-08-30')
      expect(last()).toMatchObject({
        method: 'GET',
        path: '/api/dogs/dog-1/meals',
        search: '?date=2026-08-30',
      })
    })

    it('listForDog without a date omits the query', async () => {
      const { client, last } = makeClient({ meals: [] })
      await client.meals.listForDog('dog-1')
      expect(last().search).toBe('')
    })

    it('createForDog → POST /api/dogs/:id/meals with a MealCreateSchema-valid body', async () => {
      const { client, last } = makeClient({ result: {} })
      await client.meals.createForDog('dog-1', {
        meal_type: 'breakfast',
        items: [{ ingredient_id: 'ing-1', grams: 100 }],
        source: 'manual',
        name: 'Morning bowl',
        date: '2026-08-30',
      })
      expect(last()).toMatchObject({
        method: 'POST',
        path: '/api/dogs/dog-1/meals',
      })
      expectAccepts(MealCreateSchema, last().body)
    })

    it('get → GET /api/meals/:id', async () => {
      const { client, last } = makeClient({ meal: {} })
      await client.meals.get('meal-1')
      expect(last()).toMatchObject({ method: 'GET', path: '/api/meals/meal-1' })
    })

    it('update → PATCH /api/meals/:id with a MealUpdateSchema-valid body', async () => {
      const { client, last } = makeClient({ result: {} })
      await client.meals.update('meal-1', {
        meal_type: 'dinner',
        items: [{ ingredient_id: 'ing-1', grams: 80 }],
        name: 'Evening bowl',
      })
      expect(last()).toMatchObject({ method: 'PATCH', path: '/api/meals/meal-1' })
      expectAccepts(MealUpdateSchema, last().body)
    })

    it('remove → DELETE /api/meals/:id', async () => {
      const { client, last } = makeClient({ ok: true })
      await client.meals.remove('meal-1')
      expect(last()).toMatchObject({
        method: 'DELETE',
        path: '/api/meals/meal-1',
      })
    })

    it('gaps → GET /api/dogs/:id/gaps?date=', async () => {
      const { client, last } = makeClient({})
      await client.meals.gaps('dog-1', '2026-08-30')
      expect(last()).toMatchObject({
        method: 'GET',
        path: '/api/dogs/dog-1/gaps',
        search: '?date=2026-08-30',
      })
    })
  })

  describe('ingredients', () => {
    it('search → GET /api/ingredients/search?q=', async () => {
      const { client, last } = makeClient({ foods: [] })
      await client.ingredients.search('beef')
      expect(last()).toMatchObject({
        method: 'GET',
        path: '/api/ingredients/search',
        search: '?q=beef',
      })
    })

    it('groupedSearch → GET /api/ingredients/grouped-search?q=', async () => {
      const { client, last } = makeClient({ groups: [] })
      await client.ingredients.groupedSearch('beef')
      expect(last()).toMatchObject({
        method: 'GET',
        path: '/api/ingredients/grouped-search',
        search: '?q=beef',
      })
    })

    it('variants → GET /api/ingredients/grouped-search?canonical_id=', async () => {
      const { client, last } = makeClient({ variants: [] })
      await client.ingredients.variants('canon-1')
      expect(last()).toMatchObject({
        method: 'GET',
        path: '/api/ingredients/grouped-search',
        search: '?canonical_id=canon-1',
      })
    })

    it('createManual → POST /api/ingredients/manual with a ManualIngredientSchema-valid body', async () => {
      const { client, last } = makeClient({ food: {} })
      await client.ingredients.createManual({
        name: 'Homemade kibble',
        calories_per_100g: 350,
        protein_g_per_100g: 25,
        fat_g_per_100g: 15,
        carbs_g_per_100g: 40,
      })
      expect(last()).toMatchObject({
        method: 'POST',
        path: '/api/ingredients/manual',
      })
      expectAccepts(ManualIngredientSchema, last().body)
    })

    it('acceptBranded → POST /api/ingredients/branded with a BrandedIngredientSchema-valid body', async () => {
      const { client, last } = makeClient({ food: {} })
      await client.ingredients.acceptBranded('0123456789012')
      expect(last()).toMatchObject({
        method: 'POST',
        path: '/api/ingredients/branded',
      })
      expectAccepts(BrandedIngredientSchema, last().body)
    })
  })

  describe('foods', () => {
    it('search → GET /api/foods/unified-search?q=', async () => {
      const { client, last } = makeClient({ foods: [] })
      await client.foods.search('beef')
      expect(last()).toMatchObject({
        method: 'GET',
        path: '/api/foods/unified-search',
        search: '?q=beef',
      })
    })

    it('searchByNutrient → GET /api/foods/nutrient-search?nutrient=&min=', async () => {
      const { client, last } = makeClient({ foods: [] })
      await client.foods.searchByNutrient('protein_g', 5)
      expect(last()).toMatchObject({
        method: 'GET',
        path: '/api/foods/nutrient-search',
      })
      const params = new URLSearchParams(last().search)
      expect(params.get('nutrient')).toBe('protein_g')
      expect(params.get('min')).toBe('5')
    })

    it('get → GET /api/foods/:id', async () => {
      const { client, last } = makeClient({ food: {} })
      await client.foods.get('food-1')
      expect(last()).toMatchObject({ method: 'GET', path: '/api/foods/food-1' })
    })
  })

  describe('bowl (multipart)', () => {
    it('analyze → POST /api/bowl/analyze with image + dog_id + hint parts', async () => {
      const { client, last } = makeClient({ items: [] })
      await client.bowl.analyze({
        image: new Blob(['x'], { type: 'image/jpeg' }),
        fileName: 'bowl.jpg',
        dogId: 'dog-1',
        hint: 'chicken',
      })
      const call = last()
      expect(call).toMatchObject({ method: 'POST', path: '/api/bowl/analyze' })
      expect(call.isFormData).toBe(true)
      // These part names are what app/api/bowl/analyze/route.ts reads.
      expect(Object.keys(call.body ?? {})).toEqual(
        expect.arrayContaining(['image', 'dog_id', 'hint'])
      )
      expect(call.body?.dog_id).toBe('dog-1')
    })

    it('reanalyze → POST /api/bowl/analyze with analysis_id + hint (no image)', async () => {
      const { client, last } = makeClient({ items: [] })
      await client.bowl.reanalyze({ analysisId: 'an-1', hint: 'it is salmon' })
      const call = last()
      expect(call).toMatchObject({ method: 'POST', path: '/api/bowl/analyze' })
      expect(call.isFormData).toBe(true)
      expect(call.body?.analysis_id).toBe('an-1')
      expect(call.body).not.toHaveProperty('image')
    })

    it('saveCorrections → PATCH /api/bowl/analyze with analysis_id + corrected_items (JSON)', async () => {
      const { client, last } = makeClient({ ok: true })
      await client.bowl.saveCorrections({
        analysisId: 'an-1',
        correctedItems: [],
      })
      const call = last()
      expect(call).toMatchObject({ method: 'PATCH', path: '/api/bowl/analyze' })
      expect(call.isFormData).toBe(false)
      expect(call.body).toEqual({ analysis_id: 'an-1', corrected_items: [] })
    })
  })
})

describe('api-client ↔ REST: response envelope unwrapping', () => {
  it('dogs.list unwraps { dogs }', async () => {
    const dogs = [{ id: 'd1' }]
    const { client } = makeClient({ dogs })
    await expect(client.dogs.list()).resolves.toEqual(dogs)
  })

  it('dogs.create unwraps { dog }', async () => {
    const dog = { id: 'd1' }
    const { client } = makeClient({ dog })
    await expect(
      client.dogs.create({ name: 'Rex', weight_kg: 20 })
    ).resolves.toEqual(dog)
  })

  it('meals.createForDog unwraps { result }', async () => {
    const result = { mealId: 'm1' }
    const { client } = makeClient({ result })
    await expect(
      client.meals.createForDog('d1', {
        meal_type: 'breakfast',
        items: [{ ingredient_id: 'i1', grams: 100 }],
      })
    ).resolves.toEqual(result)
  })

  it('meals.gaps returns the whole payload (no envelope)', async () => {
    const gaps = { totalKcal: 500, gaps: {} }
    const { client } = makeClient(gaps)
    await expect(client.meals.gaps('d1')).resolves.toEqual(gaps)
  })

  it('ingredients.groupedSearch unwraps { groups }', async () => {
    const groups = [{ canonical_id: 'c1' }]
    const { client } = makeClient({ groups })
    await expect(client.ingredients.groupedSearch('beef')).resolves.toEqual(
      groups
    )
  })

  it('foods.get unwraps { food }', async () => {
    const food = { id: 'f1' }
    const { client } = makeClient({ food })
    await expect(client.foods.get('f1')).resolves.toEqual(food)
  })
})

describe('api-client ↔ REST: transport invariants', () => {
  it('attaches the bearer token from getAccessToken', async () => {
    const { client, last } = makeClient({ dogs: [] })
    await client.dogs.list()
    expect(last().headers.authorization).toBe('Bearer test-token')
  })

  it('sends JSON Content-Type for JSON bodies', async () => {
    const { client, last } = makeClient({ dog: {} })
    await client.dogs.create({ name: 'Rex', weight_kg: 20 })
    expect(last().headers['content-type']).toBe('application/json')
  })

  it('does NOT set Content-Type for multipart bodies (boundary is auto-set)', async () => {
    const { client, last } = makeClient({ items: [] })
    await client.bowl.analyze({
      image: new Blob(['x'], { type: 'image/jpeg' }),
      dogId: 'dog-1',
    })
    expect(last().headers['content-type']).toBeUndefined()
  })

  it('throws ApiError carrying the status and the route\'s error message', async () => {
    const { client } = makeClient({ error: 'dog not found' }, false, 404)
    await expect(client.dogs.get('missing')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'dog not found',
    })
    // And confirm the thrown value is the exported class, not a bare Error.
    const { client: c2 } = makeClient({ error: 'x' }, false, 500)
    await expect(c2.dogs.list()).rejects.toBeInstanceOf(ApiError)
  })
})

describe('api-client ↔ REST: every path template has a live route file', () => {
  const apiDir = join(__dirname, '..', '..', 'app', 'api')
  // Left: the path template the client builds. Right: the route.ts that serves
  // it. If the client points somewhere no route exists, this fails.
  const routes: Array<[string, string]> = [
    ['/api/dogs', 'dogs/route.ts'],
    ['/api/dogs/:id', 'dogs/[dogId]/route.ts'],
    ['/api/dogs/:id/meals', 'dogs/[dogId]/meals/route.ts'],
    ['/api/dogs/:id/gaps', 'dogs/[dogId]/gaps/route.ts'],
    ['/api/meals/:id', 'meals/[mealId]/route.ts'],
    ['/api/ingredients/search', 'ingredients/search/route.ts'],
    ['/api/ingredients/grouped-search', 'ingredients/grouped-search/route.ts'],
    ['/api/ingredients/manual', 'ingredients/manual/route.ts'],
    ['/api/ingredients/branded', 'ingredients/branded/route.ts'],
    ['/api/foods/unified-search', 'foods/unified-search/route.ts'],
    ['/api/foods/nutrient-search', 'foods/nutrient-search/route.ts'],
    ['/api/foods/:id', 'foods/[foodId]/route.ts'],
    ['/api/bowl/analyze', 'bowl/analyze/route.ts'],
  ]

  it.each(routes)('%s is served by app/api/%s', (_template, file) => {
    expect(existsSync(join(apiDir, file))).toBe(true)
  })
})
