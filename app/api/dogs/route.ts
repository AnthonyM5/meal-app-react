import { authenticateRequest, errorResponse } from '@/lib/server/rest-auth'
import * as dogService from '@/lib/services/dog-service'
import { type NextRequest, NextResponse } from 'next/server'

// Mobile-facing REST wrapper over lib/services/dog-service.ts — mirrors
// lib/dog-actions.ts (the web Server Action) for a caller with no cookies.
// See docs/PAWPLATE_PROGRESS.md, mobile phasing step 2.

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth instanceof NextResponse) return auth

  try {
    const dogs = await dogService.getUserDogs(auth.supabase, auth.userId)
    return NextResponse.json({ dogs })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth instanceof NextResponse) return auth

  try {
    const input = (await request.json()) as dogService.DogInput
    const dog = await dogService.createDog(auth.supabase, auth.userId, input)
    return NextResponse.json({ dog }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
