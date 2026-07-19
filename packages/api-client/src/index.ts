import type {
  Dog,
  Ingredient,
  MealSource,
  MealType,
  NutrientGap,
  NutrientKey,
} from '@pawplate/core'

/**
 * Typed client for the mobile REST layer (apps/web/app/api — phasing step 2).
 * Method shapes mirror the web Server Actions one-for-one so mobile call
 * sites read like the existing web ones. Auth is a Supabase access token
 * supplied per-request via `getAccessToken` (native clients have no cookie).
 *
 * Input/result shapes are transcribed from lib/server/rest-schemas.ts and
 * lib/services/{dog,meal}-service.ts. If those move into @pawplate/core
 * later, these local copies should be replaced with imports.
 */

export interface PawPlateClientOptions {
  /** Origin of the deployed web app, e.g. https://pawplate.vercel.app */
  baseUrl: string
  /** Returns a current Supabase access token (refresh handled by caller). */
  getAccessToken: () => Promise<string | null> | string | null
  /** Override fetch (tests, React Native polyfills). Defaults to global fetch. */
  fetch?: typeof globalThis.fetch
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// --- request/response shapes (see note above) ---

export interface DogInput {
  name: string
  breed?: string | null
  weight_kg: number
  ideal_weight_kg?: number | null
  birth_date?: string | null
  life_stage?: Dog['life_stage']
  activity_level?: Dog['activity_level']
  neutered?: boolean
  health_conditions?: string[]
  avatar_url?: string | null
  bowl_diameter_cm?: number | null
}

export interface MealItemInput {
  ingredient_id: string
  grams: number
}

export interface MealCreateInput {
  meal_type: MealType
  items: MealItemInput[]
  source?: MealSource
  name?: string
  /** YYYY-MM-DD; defaults to today on the server */
  date?: string
}

export interface MealUpdateInput {
  meal_type: MealType
  items: MealItemInput[]
  name?: string
}

export interface DogMealResult {
  mealId: string
  dailyKcal: number
  mealKcal: number
  gaps: Partial<Record<NutrientKey, NutrientGap>>
  unsafeIngredients: Array<{
    id: string
    name: string
    toxicity_note: string | null
  }>
  requiresVetNotice: boolean
}

export interface DogDailyGaps extends Omit<DogMealResult, 'mealId' | 'mealKcal'> {
  totalKcal: number
}

export interface DogMealSummary {
  id: string
  meal_type: MealType
  name: string | null
  calories: number
  items: Array<{ name: string; grams: number }>
}

export interface DogMealForEdit {
  id: string
  dogId: string
  mealType: MealType
  name: string | null
  date: string
  items: Array<{ grams: number; food: Ingredient }>
}

export interface ManualIngredientInput {
  name: string
  calories_per_100g: number
  protein_g_per_100g?: number
  fat_g_per_100g?: number
  carbs_g_per_100g?: number
}

export function createPawPlateClient(options: PawPlateClientOptions) {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis)
  const baseUrl = options.baseUrl.replace(/\/$/, '')

  async function request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const token = await options.getAccessToken()
    const response = await doFetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      const message =
        payload && typeof payload.error === 'string'
          ? payload.error
          : `Request failed with status ${response.status}`
      throw new ApiError(response.status, message)
    }
    return payload as T
  }

  const withDate = (path: string, date?: string) =>
    date ? `${path}?date=${encodeURIComponent(date)}` : path

  return {
    dogs: {
      list: () => request<{ dogs: Dog[] }>('GET', '/api/dogs').then(r => r.dogs),
      get: (dogId: string) =>
        request<{ dog: Dog }>('GET', `/api/dogs/${dogId}`).then(r => r.dog),
      create: (input: DogInput) =>
        request<{ dog: Dog }>('POST', '/api/dogs', input).then(r => r.dog),
      update: (dogId: string, input: Partial<DogInput>) =>
        request<{ dog: Dog }>('PATCH', `/api/dogs/${dogId}`, input).then(
          r => r.dog
        ),
      remove: (dogId: string) =>
        request<{ ok: true }>('DELETE', `/api/dogs/${dogId}`).then(() => {}),
    },
    meals: {
      listForDog: (dogId: string, date?: string) =>
        request<{ meals: DogMealSummary[] }>(
          'GET',
          withDate(`/api/dogs/${dogId}/meals`, date)
        ).then(r => r.meals),
      createForDog: (dogId: string, input: MealCreateInput) =>
        request<{ result: DogMealResult }>(
          'POST',
          `/api/dogs/${dogId}/meals`,
          input
        ).then(r => r.result),
      get: (mealId: string) =>
        request<{ meal: DogMealForEdit }>('GET', `/api/meals/${mealId}`).then(
          r => r.meal
        ),
      update: (mealId: string, input: MealUpdateInput) =>
        request<{ result: DogMealResult }>(
          'PATCH',
          `/api/meals/${mealId}`,
          input
        ).then(r => r.result),
      remove: (mealId: string) =>
        request<{ ok: true }>('DELETE', `/api/meals/${mealId}`).then(() => {}),
      gaps: (dogId: string, date?: string) =>
        request<DogDailyGaps>('GET', withDate(`/api/dogs/${dogId}/gaps`, date)),
    },
    ingredients: {
      search: (query: string) =>
        request<{ foods: Ingredient[] }>(
          'GET',
          `/api/ingredients/search?q=${encodeURIComponent(query)}`
        ).then(r => r.foods),
      createManual: (input: ManualIngredientInput) =>
        request<{ food: Ingredient }>(
          'POST',
          '/api/ingredients/manual',
          input
        ).then(r => r.food),
      acceptBranded: (code: string) =>
        request<{ food: Ingredient }>('POST', '/api/ingredients/branded', {
          code,
        }).then(r => r.food),
    },
  }
}

export type PawPlateClient = ReturnType<typeof createPawPlateClient>
