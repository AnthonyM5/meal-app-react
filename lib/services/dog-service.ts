import type { Database, Dog, DogActivityLevel, DogLifeStage } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Dog CRUD business logic, shared by the Server Actions (lib/dog-actions.ts)
 * and future REST routes for the mobile app. No Next.js imports allowed here
 * — auth resolution, guest-mode checks, and revalidation belong to callers.
 */

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

export async function createDog(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  input: DogInput
): Promise<Dog> {
  validateDogInput(input, true)

  const { data, error } = await supabase
    .from('dogs')
    .insert({
      owner_id: ownerId,
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
  return data as Dog
}

export async function getUserDogs(
  supabase: SupabaseClient<Database>,
  ownerId: string
): Promise<Dog[]> {
  const { data, error } = await supabase
    .from('dogs')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data || []) as Dog[]
}

export async function getDog(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  dogId: string
): Promise<Dog> {
  const { data, error } = await supabase
    .from('dogs')
    .select('*')
    .eq('id', dogId)
    .eq('owner_id', ownerId)
    // maybeSingle, not single: zero rows (nonexistent id, or someone else's
    // dog since owner_id is filtered above) is an expected "not found"
    // outcome here, not a query error — single() would throw a raw
    // Postgrest "no rows" error instead of reaching the check below.
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Dog not found')
  return data as Dog
}

export async function updateDog(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  dogId: string,
  updates: Partial<DogInput>
): Promise<Dog> {
  validateDogInput(updates, false)

  const { data: existing, error: fetchError } = await supabase
    .from('dogs')
    .select('owner_id')
    .eq('id', dogId)
    // maybeSingle: see the comment on getDog above.
    .maybeSingle()

  if (fetchError) throw fetchError
  if (!existing) throw new Error('Dog not found')
  if (existing.owner_id !== ownerId) throw new Error('Unauthorized')

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
  return data as Dog
}

export async function deleteDog(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  dogId: string
): Promise<void> {
  const { data: existing, error: fetchError } = await supabase
    .from('dogs')
    .select('owner_id')
    .eq('id', dogId)
    // maybeSingle: see the comment on getDog above.
    .maybeSingle()

  if (fetchError) throw fetchError
  if (!existing) throw new Error('Dog not found')
  if (existing.owner_id !== ownerId) throw new Error('Unauthorized')

  const { error } = await supabase.from('dogs').delete().eq('id', dogId)
  if (error) throw error
}
