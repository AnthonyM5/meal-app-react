'use server'

import { getAuthenticatedClientOrRedirect } from '@/lib/server/auth-context'
import * as ingredientService from '@/lib/services/ingredient-service'
import type { Food } from '@/lib/types'

export type { ManualIngredientInput } from '@/lib/services/ingredient-service'

export async function createManualIngredient(
  input: ingredientService.ManualIngredientInput
): Promise<Food> {
  const { supabase, user } = await getAuthenticatedClientOrRedirect()
  return ingredientService.createManualIngredient(supabase, user.id, input)
}

export async function acceptBrandedIngredient(code: string): Promise<Food> {
  const { supabase } = await getAuthenticatedClientOrRedirect()
  return ingredientService.acceptBrandedIngredient(supabase, code)
}
