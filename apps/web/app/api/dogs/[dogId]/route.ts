import { authenticateRequest, errorResponse, readJson } from '@/lib/server/rest-auth'
import { DogUpdateSchema } from '@/lib/server/rest-schemas'
import * as dogService from '@/lib/services/dog-service'
import { type NextRequest, NextResponse } from 'next/server'

// Mobile-facing REST wrapper over lib/services/dog-service.ts — mirrors
// lib/dog-actions.ts (the web Server Action) for a caller with no cookies.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dogId: string }> }
) {
  const auth = await authenticateRequest(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { dogId } = await params
    const dog = await dogService.getDog(auth.supabase, auth.userId, dogId)
    return NextResponse.json({ dog })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ dogId: string }> }
) {
  const auth = await authenticateRequest(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { dogId } = await params
    const updates = await readJson(request, DogUpdateSchema)
    if (updates instanceof NextResponse) return updates
    const dog = await dogService.updateDog(
      auth.supabase,
      auth.userId,
      dogId,
      updates
    )
    return NextResponse.json({ dog })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ dogId: string }> }
) {
  const auth = await authenticateRequest(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { dogId } = await params
    await dogService.deleteDog(auth.supabase, auth.userId, dogId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}
