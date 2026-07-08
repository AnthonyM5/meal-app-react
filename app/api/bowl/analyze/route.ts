import { createClient as createUserClient } from '@/lib/supabase/server'
import type { Database, Ingredient } from '@/lib/types'
import {
  analyzeBowlImage,
  type NormalizedBowlItem,
} from '@/lib/vision/analyze-bowl'
import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

// Accepts a bowl photo, runs the vision model, normalizes labels against the
// ingredients table via the existing fuzzy_search_foods RPC, persists a
// bowl_analyses row, and returns the structured result for the
// confirmation UI. Corrections are saved separately via PATCH — that
// user_corrected data is the eval / fine-tune signal; never skip it.
//
// AUTHORIZATION: the service-role client below bypasses RLS, so every request
// must first be tied to an authenticated user and the target dog must be
// verified as theirs. Middleware only guarantees a session exists — it cannot
// stop user A from passing user B's dog_id.

const BUCKET = 'bowl-photos'

function isSupabaseConfigured(): boolean {
  return !!(
    typeof process.env.NEXT_PUBLIC_SUPABASE_URL === 'string' &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
    typeof process.env.SUPABASE_SERVICE_ROLE_KEY === 'string' &&
    process.env.SUPABASE_SERVICE_ROLE_KEY.length > 0
  )
}

function createSupabaseClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { get: () => undefined, set: () => {}, remove: () => {} } }
  )
}

/** Resolve the calling user from the session cookie, or null. */
async function getAuthenticatedUserId(): Promise<string | null> {
  const client = await createUserClient()
  // The guest/unconfigured DummyClient has `auth` but no `from`
  if (!('from' in client)) return null
  const {
    data: { user },
  } = await client.auth.getUser()
  return user?.id ?? null
}

/** True when `dogId` exists and is owned by `userId`. */
async function userOwnsDog(
  supabase: ReturnType<typeof createSupabaseClient>,
  dogId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('dogs')
    .select('id')
    .eq('id', dogId)
    .eq('owner_id', userId)
    .maybeSingle()
  return !!data
}

/** Trigram-confidence floor below which a label stays unmatched. */
const MATCH_THRESHOLD = 0.3

async function normalizeLabel(
  supabase: ReturnType<typeof createSupabaseClient>,
  label: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc('fuzzy_search_foods', {
    search_query: label,
    match_limit: 1,
  })
  if (error || !data || data.length === 0) return null
  const top = data[0] as { id: string; similarity?: number }
  if (top.similarity != null && top.similarity < MATCH_THRESHOLD) return null
  return top.id
}

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    }
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Bowl analysis is not configured (missing GEMINI_API_KEY)' },
        { status: 503 }
      )
    }

    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('image')
    const dogId = formData.get('dog_id')

    // Authorize before validating (or reading) the upload: never do work, or
    // leak which inputs are wrong, for a dog the caller doesn't own.
    // Required — an analysis with no dog can't be ownership-checked on PATCH.
    if (typeof dogId !== 'string' || !dogId) {
      return NextResponse.json({ error: 'dog_id is required' }, { status: 400 })
    }

    const supabase = createSupabaseClient()

    if (!(await userOwnsDog(supabase, dogId, userId))) {
      return NextResponse.json({ error: 'Dog not found' }, { status: 404 })
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'image file is required' }, { status: 400 })
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
    if (!allowed.includes(file.type as (typeof allowed)[number])) {
      return NextResponse.json({ error: `Unsupported image type: ${file.type}` }, { status: 400 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())

    // Store the photo (bucket must exist; create in Supabase dashboard/migration)
    const path = `${dogId}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: file.type })
    if (uploadError) {
      return NextResponse.json(
        { error: `Failed to store image: ${uploadError.message}` },
        { status: 500 }
      )
    }
    const imageUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

    // Vision model → structured, Zod-validated items
    const { result, modelVersion, raw } = await analyzeBowlImage({
      imageBase64: bytes.toString('base64'),
      mediaType: file.type as (typeof allowed)[number],
    })

    // Normalize labels via the existing pg_trgm fuzzy search
    const identifiedItems: NormalizedBowlItem[] = []
    for (const item of result.items) {
      identifiedItems.push({
        ...item,
        normalized_ingredient_id: await normalizeLabel(supabase, item.label),
      })
    }

    const { data: analysis, error: insertError } = await supabase
      .from('bowl_analyses')
      .insert({
        dog_id: dogId,
        image_url: imageUrl,
        model_version: modelVersion,
        raw_output: raw,
        identified_items: identifiedItems,
        user_corrected: null,
      })
      .select()
      .single()
    if (insertError) {
      return NextResponse.json(
        { error: `Failed to persist analysis: ${insertError.message}` },
        { status: 500 }
      )
    }

    // Hydrate matched ingredients in one query so the confirmation UI has the
    // full rows (name, kcal, safety) without N client round-trips.
    const matchedIds = identifiedItems
      .map(item => item.normalized_ingredient_id)
      .filter((id): id is string => !!id)

    const ingredientsById = new Map<string, Ingredient>()
    if (matchedIds.length > 0) {
      const { data: foods } = await supabase
        .from('foods')
        .select('*')
        .in('id', matchedIds)
      for (const food of (foods || []) as Ingredient[]) {
        ingredientsById.set(food.id, food)
      }
    }

    return NextResponse.json({
      analysis_id: analysis.id,
      image_url: imageUrl,
      items: identifiedItems.map(item => ({
        ...item,
        ingredient: item.normalized_ingredient_id
          ? ingredientsById.get(item.normalized_ingredient_id) ?? null
          : null,
      })),
      notes: result.notes,
    })
  } catch (error) {
    console.error('Bowl analysis error:', error)
    return NextResponse.json({ error: 'Bowl analysis failed' }, { status: 500 })
  }
}

/**
 * Persist the owner's corrections after the confirmation UI.
 * This is the gold data for vision evals — always call on save.
 */
export async function PATCH(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    }

    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { analysis_id, corrected_items } = await request.json()
    if (!analysis_id || !Array.isArray(corrected_items)) {
      return NextResponse.json(
        { error: 'analysis_id and corrected_items are required' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseClient()

    // The analysis must hang off a dog this user owns.
    const { data: analysis } = await supabase
      .from('bowl_analyses')
      .select('id, dog_id')
      .eq('id', analysis_id)
      .maybeSingle()

    if (
      !analysis?.dog_id ||
      !(await userOwnsDog(supabase, analysis.dog_id, userId))
    ) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('bowl_analyses')
      .update({ user_corrected: corrected_items })
      .eq('id', analysis_id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Bowl correction error:', error)
    return NextResponse.json({ error: 'Failed to save corrections' }, { status: 500 })
  }
}
