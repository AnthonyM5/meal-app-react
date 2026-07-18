'use server'

import {
  getAuthenticatedClientOrRedirect,
  isGuestMode,
} from '@/lib/server/auth-context'
import * as dogService from '@/lib/services/dog-service'
import type { Dog } from '@/lib/types'
import { revalidatePath } from 'next/cache'

export type { DogInput } from '@/lib/services/dog-service'

export async function createDog(input: dogService.DogInput): Promise<Dog> {
  if (await isGuestMode()) {
    throw new Error('Please sign in to add a dog')
  }

  const { supabase, user } = await getAuthenticatedClientOrRedirect()
  const dog = await dogService.createDog(supabase, user.id, input)

  revalidatePath('/dashboard')
  return dog
}

export async function getUserDogs(): Promise<Dog[]> {
  const { supabase, user } = await getAuthenticatedClientOrRedirect()
  return dogService.getUserDogs(supabase, user.id)
}

export async function getDog(dogId: string): Promise<Dog> {
  const { supabase, user } = await getAuthenticatedClientOrRedirect()
  return dogService.getDog(supabase, user.id, dogId)
}

export async function updateDog(
  dogId: string,
  updates: Partial<dogService.DogInput>
): Promise<Dog> {
  if (await isGuestMode()) {
    throw new Error('Please sign in to update a dog')
  }

  const { supabase, user } = await getAuthenticatedClientOrRedirect()
  const dog = await dogService.updateDog(supabase, user.id, dogId, updates)

  revalidatePath('/dashboard')
  return dog
}

export async function deleteDog(dogId: string): Promise<void> {
  if (await isGuestMode()) {
    throw new Error('Please sign in to delete a dog')
  }

  const { supabase, user } = await getAuthenticatedClientOrRedirect()
  await dogService.deleteDog(supabase, user.id, dogId)

  revalidatePath('/dashboard')
}
