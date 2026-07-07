'use server'

import { createClient } from '@/lib/supabase/server'
import type { Database, Dog, DogActivityLevel, DogLifeStage } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

type DummyClient = {
  auth: {
    getUser: () => Promise<{ data: { user: null }; error: null }>
    getSession: () => Promise<{ data: { session: null }; error: null }>
  }
}

function isDummyClient(
  client: SupabaseClient<Database> | DummyClient
): client is DummyClient {
  return !('from' in client)
}

async function getClient() {
  const client = await createClient()
  if (isDummyClient(client)) {
    throw new Error('Database client not properly initialized')
  }
  return client as SupabaseClient<Database>
}

async function getAuthenticatedClientOrRedirect() {
  const supabase = await getClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/auth/login')
  }

  return { supabase, user }
}

async function isGuestMode(): Promise<boolean> {
  const client = await getClient()
  const {
    data: { session },
  } = await client.auth.getSession()

  if (session) return false

  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  return cookieStore.get('guestMode')?.value === 'true'
}

export interface DogInput {
  name: string
  breed?: string | null
  weight_kg: number
  ideal_weight_kg?: number | null
  birth_date?: string | null
  life_stage?: DogLifeStage
  activity_level?: DogActivityLevel
  neutered?: boolean
  health_conditions?: string[]
  avatar_url?: string | null
}

function validateDogInput(input: Partial<DogInput>, requireAll: boolean) {
  if (requireAll || input.name !== undefined) {
    if (!input.name || input.name.trim().length === 0) {
      throw new Error('Dog name is required')
    }
  }
  if (requireAll || input.weight_kg !== undefined) {
    if (input.weight_kg == null || input.weight_kg <= 0) {
      throw new Error('Weight must be greater than 0')
    }
  }
  if (input.ideal_weight_kg != null && input.ideal_weight_kg <= 0) {
    throw new Error('Ideal weight must be greater than 0')
  }
}

export async function createDog(input: DogInput): Promise<Dog> {
  if (await isGuestMode()) {
    throw new Error('Please sign in to add a dog')
  }

  validateDogInput(input, true)

  const { supabase, user } = await getAuthenticatedClientOrRedirect()

  const { data, error } = await supabase
    .from('dogs')
    .insert({
      owner_id: user.id,
      name: input.name.trim(),
      breed: input.breed?.trim() || null,
      weight_kg: input.weight_kg,
      ideal_weight_kg: input.ideal_weight_kg ?? null,
      birth_date: input.birth_date ?? null,
      life_stage: input.life_stage ?? 'adult',
      activity_level: input.activity_level ?? 'moderately_active',
      neutered: input.neutered ?? true,
      health_conditions: input.health_conditions ?? [],
      avatar_url: input.avatar_url ?? null,
    })
    .select()
    .single()

  if (error) throw error
  if (!data) throw new Error('Failed to create dog')

  revalidatePath('/dashboard')
  return data as Dog
}

export async function getUserDogs(): Promise<Dog[]> {
  const { supabase, user } = await getAuthenticatedClientOrRedirect()

  const { data, error } = await supabase
    .from('dogs')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data || []) as Dog[]
}

export async function getDog(dogId: string): Promise<Dog> {
  const { supabase, user } = await getAuthenticatedClientOrRedirect()

  const { data, error } = await supabase
    .from('dogs')
    .select('*')
    .eq('id', dogId)
    .eq('owner_id', user.id)
    .single()

  if (error) throw error
  if (!data) throw new Error('Dog not found')
  return data as Dog
}

export async function updateDog(
  dogId: string,
  updates: Partial<DogInput>
): Promise<Dog> {
  if (await isGuestMode()) {
    throw new Error('Please sign in to update a dog')
  }

  validateDogInput(updates, false)

  const { supabase, user } = await getAuthenticatedClientOrRedirect()

  const { data: existing, error: fetchError } = await supabase
    .from('dogs')
    .select('owner_id')
    .eq('id', dogId)
    .single()

  if (fetchError) throw fetchError
  if (!existing) throw new Error('Dog not found')
  if (existing.owner_id !== user.id) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('dogs')
    .update({
      ...(updates.name !== undefined && { name: updates.name.trim() }),
      ...(updates.breed !== undefined && { breed: updates.breed?.trim() || null }),
      ...(updates.weight_kg !== undefined && { weight_kg: updates.weight_kg }),
      ...(updates.ideal_weight_kg !== undefined && {
        ideal_weight_kg: updates.ideal_weight_kg,
      }),
      ...(updates.birth_date !== undefined && { birth_date: updates.birth_date }),
      ...(updates.life_stage !== undefined && { life_stage: updates.life_stage }),
      ...(updates.activity_level !== undefined && {
        activity_level: updates.activity_level,
      }),
      ...(updates.neutered !== undefined && { neutered: updates.neutered }),
      ...(updates.health_conditions !== undefined && {
        health_conditions: updates.health_conditions,
      }),
      ...(updates.avatar_url !== undefined && { avatar_url: updates.avatar_url }),
    })
    .eq('id', dogId)
    .select()
    .single()

  if (error) throw error
  if (!data) throw new Error('Failed to update dog')

  revalidatePath('/dashboard')
  return data as Dog
}

export async function deleteDog(dogId: string): Promise<void> {
  if (await isGuestMode()) {
    throw new Error('Please sign in to delete a dog')
  }

  const { supabase, user } = await getAuthenticatedClientOrRedirect()

  const { data: existing, error: fetchError } = await supabase
    .from('dogs')
    .select('owner_id')
    .eq('id', dogId)
    .single()

  if (fetchError) throw fetchError
  if (!existing) throw new Error('Dog not found')
  if (existing.owner_id !== user.id) throw new Error('Unauthorized')

  const { error } = await supabase.from('dogs').delete().eq('id', dogId)
  if (error) throw error

  revalidatePath('/dashboard')
}
