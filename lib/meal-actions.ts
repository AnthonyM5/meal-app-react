'use server'

import {
  getAuthenticatedClientOrRedirect,
  isGuestMode,
} from '@/lib/server/auth-context'
import * as mealService from '@/lib/services/meal-service'
import type { MealSource, MealType } from '@/lib/types'
import { revalidatePath } from 'next/cache'

export type {
  DogMealForEdit,
  DogMealItemInput,
  DogMealResult,
  DogMealSummary,
} from '@/lib/services/meal-service'

export async function createDogMeal(
  dogId: string,
  mealType: MealType,
  items: mealService.DogMealItemInput[],
  options: { source?: MealSource; name?: string; date?: string } = {}
): Promise<mealService.DogMealResult> {
  if (await isGuestMode()) {
    throw new Error('Please sign in to log meals')
  }

  const { supabase, user } = await getAuthenticatedClientOrRedirect()
  const result = await mealService.createDogMeal(
    supabase,
    user.id,
    dogId,
    mealType,
    items,
    options
  )

  revalidatePath('/dashboard')
  return result
}

export async function getDogMealForEdit(
  mealId: string
): Promise<mealService.DogMealForEdit> {
  const { supabase, user } = await getAuthenticatedClientOrRedirect()
  return mealService.getDogMealForEdit(supabase, user.id, mealId)
}

export async function updateDogMeal(
  mealId: string,
  mealType: MealType,
  items: mealService.DogMealItemInput[],
  options: { name?: string } = {}
): Promise<mealService.DogMealResult> {
  if (await isGuestMode()) {
    throw new Error('Please sign in to edit meals')
  }

  const { supabase, user } = await getAuthenticatedClientOrRedirect()
  const result = await mealService.updateDogMeal(
    supabase,
    user.id,
    mealId,
    mealType,
    items,
    options
  )

  revalidatePath('/dashboard')
  return result
}

export async function getDogDailyGaps(
  dogId: string,
  date?: string
): Promise<
  Omit<mealService.DogMealResult, 'mealId' | 'mealKcal'> & { totalKcal: number }
> {
  const { supabase, user } = await getAuthenticatedClientOrRedirect()
  return mealService.getDogDailyGaps(supabase, user.id, dogId, date)
}

export async function getDogMeals(
  dogId: string,
  date?: string
): Promise<mealService.DogMealSummary[]> {
  const { supabase, user } = await getAuthenticatedClientOrRedirect()
  return mealService.getDogMeals(supabase, user.id, dogId, date)
}

export async function deleteDogMeal(mealId: string): Promise<void> {
  if (await isGuestMode()) {
    throw new Error('Please sign in to delete meals')
  }

  const { supabase, user } = await getAuthenticatedClientOrRedirect()
  await mealService.deleteDogMeal(supabase, user.id, mealId)

  revalidatePath('/dashboard')
}
