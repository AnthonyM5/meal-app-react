import {
  GUEST_BOWL_DAILY_LIMIT,
  consumeGuestBowlQuota,
} from '@/lib/guest-rate-limit'
import {
  matchIngredientWithCanonical,
  suggestBranded,
  type BrandedSuggestion,
  type CanonicalMatch,
} from '@/lib/resolve-ingredient'
import { createClient as createUserClient } from '@/lib/supabase/server'
import type { Database, Ingredient } from '@/lib/types'
import {
  MAX_USER_HINT_LENGTH,
  analyzeBowlImage,
  type Box2D,
  type NormalizedBowlItem,
} from '@/lib/vision/analyze-bowl'
import {
  estimateItemGrams,
  resolveScale,
  type DetectedReferenceObject,
} from '@/lib/vision/portion-estimate'
import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

// Accepts a bowl photo, runs the vision model, normalizes labels against the
// ingredients table via the existing fuzzy_search_foods RPC, persists a
// bowl_analyses row, and returns the structured result for the
// confirmation UI. Corrections are saved separately via PATCH — that
// user_corrected data is the eval / fine-tune signal; never skip it.
//
// AUTHORIZATION: the service-role client below bypasses RLS, so an authenticated
// request must be tied to a user and the target dog verified as theirs.
// Middleware only guarantees a session exists — it cannot stop user A from
// passing user B's dog_id.
//
// GUEST MODE: unauthenticated callers get a strictly reduced, read-only scan —
// identification and safety flags, nothing written. No storage upload, no
// bowl_analyses row, no analysis_id (so there is nothing for PATCH to target),
// and any dog_id they send is ignored outright rather than checked, so the
// endpoint can't be used to probe which dog IDs exist. Because `guestMode` is a
// client-set cookie, this path is effectively public and is metered per IP.

const BUCKET = 'bowl-photos'

const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const
type AcceptedType = (typeof ACCEPTED_TYPES)[number]

/** Matches the bowl-photos bucket limit. Enforced in-app for BOTH paths: the
 *  guest path never uploads, and the owner path buffers the whole file into
 *  memory (arrayBuffer) before the bucket could reject it — so a size check
 *  after that point is too late to prevent the memory cost. */
const MAX_BYTES = 10 * 1024 * 1024

/**
 * Validate an uploaded image. Returns an error response, or the narrowed File.
 * Shared so the guest and owner paths can't drift on what they accept.
 */
function validateImageUpload(
  file: FormDataEntryValue | null
): NextResponse | { file: File; type: AcceptedType } {
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'image file is required' }, { status: 400 })
  }
  if (!ACCEPTED_TYPES.includes(file.type as AcceptedType)) {
    return NextResponse.json(
      { error: `Unsupported image type: ${file.type}` },
      { status: 400 }
    )
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'That photo is larger than 10 MB' },
      { status: 413 }
    )
  }
  return { file, type: file.type as AcceptedType }
}

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

/**
 * Resolve the calling user, or null. Prefers an `Authorization: Bearer
 * <access_token>` header (the native shell holds its own Supabase session and
 * has no cookie, per the mobile-strategy auth notes) and falls back to the
 * session cookie for the web app. Guest mode is handled earlier via the
 * `guestMode` cookie, so a caller here with neither a valid token nor a
 * session is simply unauthenticated.
 */
async function getAuthenticatedUserId(
  request: NextRequest
): Promise<string | null> {
  const match = (request.headers.get('authorization') ?? '').match(
    /^Bearer\s+(.+)$/i
  )
  if (match) {
    // Native Bearer path: verify the access token with the service client.
    // getUser(jwt) validates the token server-side regardless of the client's
    // own key — same pattern as lib/server/rest-auth.ts.
    const {
      data: { user },
    } = await createSupabaseClient().auth.getUser(match[1])
    return user?.id ?? null
  }

  const client = await createUserClient()
  // The guest/unconfigured DummyClient has `auth` but no `from`
  if (!('from' in client)) return null
  const {
    data: { user },
  } = await client.auth.getUser()
  return user?.id ?? null
}

/**
 * The dog row (id + bowl calibration) when `dogId` exists and is owned by
 * `userId`, else null. The diameter rides along so the portion estimator can
 * use the owner-measured bowl as the photo's scale reference.
 */
async function getOwnedDog(
  supabase: ReturnType<typeof createSupabaseClient>,
  dogId: string,
  userId: string
): Promise<{ id: string; bowl_diameter_cm: number | null } | null> {
  const { data } = await supabase
    .from('dogs')
    .select('id, bowl_diameter_cm')
    .eq('id', dogId)
    .eq('owner_id', userId)
    .maybeSingle()
  return data ?? null
}

/**
 * Normalize the optional owner hint from form data: trimmed, length-capped,
 * null when absent/blank. The hint guides identification only — it can never
 * carry grams or nutrient values (enforced by the vision system prompt).
 */
function parseHint(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null
  const hint = value.trim().slice(0, MAX_USER_HINT_LENGTH)
  return hint.length > 0 ? hint : null
}

/**
 * Run vision + fuzzy normalization, hydrate the matched ingredient rows, and
 * attach deterministic gram ESTIMATES when the photo contains a usable scale
 * reference (owner-measured bowl diameter, or a coin/card in frame). The
 * model never outputs weights — lib/vision/portion-estimate.ts derives them
 * from the model's bounding boxes, and the UI always presents them as
 * owner-confirmable estimates.
 */
async function identifyBowl(
  supabase: ReturnType<typeof createSupabaseClient>,
  bytes: Buffer,
  mediaType: AcceptedType,
  userHint: string | null,
  bowlDiameterCm: number | null
) {
  const { result, modelVersion, raw } = await analyzeBowlImage({
    imageBase64: bytes.toString('base64'),
    mediaType,
    userHint: userHint ?? undefined,
    bowlDiameterCm,
  })

  const scale = resolveScale({
    bowlBox: (result.bowl_box_2d ?? null) as Box2D | null,
    bowlDiameterCm,
    referenceObject: (result.reference_object ?? null) as
      | DetectedReferenceObject
      | null,
  })

  // Local match first (unsafe rows are never auto-matched); items the local
  // table can't resolve get a best-effort Open (Pet) Food Facts SUGGESTION
  // in parallel — surfaced for the owner to confirm, never auto-committed.
  // Resolve every item to a row AND to its canonical group. The group is what
  // lets the confirmation screen demand an explicit variant choice: the model
  // says "ground beef" and cannot see the lean/fat ratio, so picking the top
  // scoring row would silently commit an assumption worth up to 2.7x in
  // calories. See CanonicalMatch in lib/resolve-ingredient.ts.
  //
  // Resolved in PARALLEL: canonical lookup costs ~3 round trips per item on
  // top of the search, and a bowl carries up to a handful of items. Run
  // sequentially that is a visible stall appended to an already-slow vision
  // call. Promise.all preserves input order, so item order is unchanged.
  const identifiedItems: (NormalizedBowlItem & {
    branded_suggestion: BrandedSuggestion | null
    estimated_grams: number | null
    canonical: CanonicalMatch | null
  })[] = await Promise.all(
    result.items.map(async item => {
      const matched = await matchIngredientWithCanonical(supabase, item.label)
      return {
        ...item,
        normalized_ingredient_id: matched.ingredientId,
        canonical: matched.canonical,
        branded_suggestion: null,
        estimated_grams: scale
          ? estimateItemGrams({
              label: item.label,
              confidence: item.confidence,
              box: (item.box_2d ?? null) as Box2D | null,
              scale,
            })
          : null,
      }
    })
  )
  await Promise.all(
    identifiedItems
      .filter(item => !item.normalized_ingredient_id)
      .map(async item => {
        item.branded_suggestion = await suggestBranded(item.label)
      })
  )

  // Hydrate matched ingredients in one query so the UI has the full rows
  // (name, kcal, safety) without N client round-trips.
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

  const items = identifiedItems.map(item => ({
    ...item,
    ingredient: item.normalized_ingredient_id
      ? ingredientsById.get(item.normalized_ingredient_id) ?? null
      : null,
  }))

  return {
    identifiedItems,
    items,
    notes: result.notes,
    modelVersion,
    raw,
    scaleBasis: scale?.basis ?? null,
  }
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

    // The guest cookie wins over any session, matching the dashboard and the
    // bowl page. Those surfaces render the guest UI whenever the cookie is set,
    // so a signed-in user who is *viewing* as a guest sends no dog_id — if the
    // route dispatched on the session instead, it would demand one and fail.
    //
    // Safe because this can only ever DOWNGRADE: honoring the cookie takes the
    // caller to the reduced, metered, write-nothing path. Nothing is granted by
    // presenting it, so a forged cookie buys an attacker strictly less.
    const isGuestMode = request.cookies.get('guestMode')?.value === 'true'
    const userId = isGuestMode ? null : await getAuthenticatedUserId(request)

    const formData = await request.formData()
    const file = formData.get('image')
    const hint = parseHint(formData.get('hint'))
    const analysisId = formData.get('analysis_id')

    // Re-analysis of an existing photo (owner noticed a miss on the confirm
    // screen): no re-upload, owner-only. Guests never have an analysis_id.
    if (typeof analysisId === 'string' && analysisId) {
      if (userId === null) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
      }
      return await handleOwnerReanalyze(userId, analysisId, hint)
    }

    return userId === null
      ? await handleGuestScan(request, file, hint)
      : await handleOwnerScan(userId, file, formData.get('dog_id'), hint)
  } catch (error) {
    console.error('Bowl analysis error:', error)
    return NextResponse.json({ error: 'Bowl analysis failed' }, { status: 500 })
  }
}

/**
 * Unauthenticated scan: metered, read-only, writes nothing.
 *
 * Any `dog_id` in the form data is deliberately never read — a guest has no
 * dog, and silently ignoring it is safer than checking it (a 404-vs-200 split
 * would turn this into a dog-ID oracle for an unauthenticated caller).
 */
async function handleGuestScan(
  request: NextRequest,
  file: FormDataEntryValue | null,
  hint: string | null
) {
  // Meter BEFORE touching the image or the model — the quota exists to cap
  // spend, and decoding a 10 MB upload for a caller who is over limit is spend.
  const quota = await consumeGuestBowlQuota(request.headers)
  if (!quota.allowed) {
    const status = quota.reason === 'limit_reached' ? 429 : 503
    return NextResponse.json(
      {
        error:
          quota.reason === 'limit_reached'
            ? `Guest scans are limited to ${GUEST_BOWL_DAILY_LIMIT} per day. Sign up for unlimited scans.`
            : 'Guest bowl analysis is temporarily unavailable. Sign in to analyze a bowl.',
        guest_limit_reached: quota.reason === 'limit_reached',
      },
      { status }
    )
  }

  const validated = validateImageUpload(file)
  if (validated instanceof NextResponse) return validated

  const bytes = Buffer.from(await validated.file.arrayBuffer())
  const supabase = createSupabaseClient()

  // The photo is analyzed in memory and dropped. Nothing is uploaded, so
  // there is no anonymous object to retain, serve, or clean up later.
  // Guests have no dog profile, so no bowl calibration — a coin/card in
  // frame is their only route to gram estimates.
  const { items, notes, scaleBasis } = await identifyBowl(
    supabase,
    bytes,
    validated.type,
    hint,
    null
  )

  // No analysis_id and no image_url: a guest result is not a persisted
  // analysis, and PATCH must have nothing to aim at.
  return NextResponse.json({ guest: true, items, notes, scale_basis: scaleBasis })
}

/** Authenticated scan: ownership-checked, photo stored, analysis persisted. */
async function handleOwnerScan(
  userId: string,
  file: FormDataEntryValue | null,
  dogId: FormDataEntryValue | null,
  hint: string | null
) {
  // Authorize before validating (or reading) the upload: never do work, or
  // leak which inputs are wrong, for a dog the caller doesn't own.
  // Required — an analysis with no dog can't be ownership-checked on PATCH.
  if (typeof dogId !== 'string' || !dogId) {
    return NextResponse.json({ error: 'dog_id is required' }, { status: 400 })
  }

  const supabase = createSupabaseClient()

  const dog = await getOwnedDog(supabase, dogId, userId)
  if (!dog) {
    return NextResponse.json({ error: 'Dog not found' }, { status: 404 })
  }

  const validated = validateImageUpload(file)
  if (validated instanceof NextResponse) return validated

  const bytes = Buffer.from(await validated.file.arrayBuffer())

  // Store the photo (bucket must exist; create in Supabase dashboard/migration)
  const path = `${dogId}/${Date.now()}-${validated.file.name}`
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: validated.type })
  if (uploadError) {
    return NextResponse.json(
      { error: `Failed to store image: ${uploadError.message}` },
      { status: 500 }
    )
  }
  const imageUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

  const { identifiedItems, items, notes, modelVersion, raw, scaleBasis } =
    await identifyBowl(
      supabase,
      bytes,
      validated.type,
      hint,
      dog.bowl_diameter_cm != null ? Number(dog.bowl_diameter_cm) : null
    )

  const { data: analysis, error: insertError } = await supabase
    .from('bowl_analyses')
    .insert({
      dog_id: dogId,
      image_url: imageUrl,
      model_version: modelVersion,
      raw_output: raw,
      identified_items: identifiedItems,
      user_corrected: null,
      user_hint: hint,
    })
    .select()
    .single()
  if (insertError) {
    return NextResponse.json(
      { error: `Failed to persist analysis: ${insertError.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    analysis_id: analysis.id,
    image_url: imageUrl,
    items,
    notes,
    scale_basis: scaleBasis,
  })
}

/**
 * Re-run the vision model on an ALREADY-UPLOADED photo with an owner hint —
 * the owner usually only notices a missed item once the confirmation UI is
 * up, and shouldn't have to re-photograph the bowl to fix it. The existing
 * bowl_analyses row is updated in place (latest pass + latest hint win);
 * the hint itself is kept as the Phase 6 eval signal for what the first
 * pass missed.
 */
async function handleOwnerReanalyze(
  userId: string,
  analysisId: string,
  hint: string | null
) {
  if (!hint) {
    return NextResponse.json(
      { error: 'A note is required to re-analyze' },
      { status: 400 }
    )
  }

  const supabase = createSupabaseClient()

  // Same ownership rule as PATCH: the analysis must hang off the caller's dog.
  const { data: analysis } = await supabase
    .from('bowl_analyses')
    .select('id, dog_id, image_url')
    .eq('id', analysisId)
    .maybeSingle()
  if (!analysis?.dog_id) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
  }
  const dog = await getOwnedDog(supabase, analysis.dog_id, userId)
  if (!dog) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
  }

  // Recover the storage object path from the stored public URL and download
  // the original bytes — never trust a client-supplied image for a re-run.
  const marker = `/object/public/${BUCKET}/`
  const markerIndex = analysis.image_url.indexOf(marker)
  if (markerIndex === -1) {
    return NextResponse.json(
      { error: 'Stored photo is unavailable for re-analysis' },
      { status: 500 }
    )
  }
  const path = decodeURIComponent(
    analysis.image_url.slice(markerIndex + marker.length)
  )
  const { data: blob, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(path)
  if (downloadError || !blob) {
    return NextResponse.json(
      { error: 'Stored photo is unavailable for re-analysis' },
      { status: 500 }
    )
  }

  const mediaType = ACCEPTED_TYPES.includes(blob.type as AcceptedType)
    ? (blob.type as AcceptedType)
    : 'image/jpeg'
  const bytes = Buffer.from(await blob.arrayBuffer())

  const { identifiedItems, items, notes, modelVersion, raw, scaleBasis } =
    await identifyBowl(
      supabase,
      bytes,
      mediaType,
      hint,
      dog.bowl_diameter_cm != null ? Number(dog.bowl_diameter_cm) : null
    )

  const { error: updateError } = await supabase
    .from('bowl_analyses')
    .update({
      model_version: modelVersion,
      raw_output: raw,
      identified_items: identifiedItems,
      user_hint: hint,
    })
    .eq('id', analysisId)
  if (updateError) {
    return NextResponse.json(
      { error: `Failed to persist analysis: ${updateError.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    analysis_id: analysisId,
    image_url: analysis.image_url,
    items,
    notes,
    scale_basis: scaleBasis,
  })
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

    const userId = await getAuthenticatedUserId(request)
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
      !(await getOwnedDog(supabase, analysis.dog_id, userId))
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
