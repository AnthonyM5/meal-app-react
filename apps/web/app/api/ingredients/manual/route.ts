import { authenticateRequest, errorResponse, readJson } from '@/lib/server/rest-auth'
import { ManualIngredientSchema } from '@/lib/server/rest-schemas'
import * as ingredientService from '@/lib/services/ingredient-service'
import { type NextRequest, NextResponse } from 'next/server'

// Mobile-facing REST wrapper over lib/services/ingredient-service.ts —
// mirrors createManualIngredient in lib/ingredient-actions.ts for a caller
// with no cookies.

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth instanceof NextResponse) return auth

  try {
    const input = await readJson(request, ManualIngredientSchema)
    if (input instanceof NextResponse) return input
    const food = await ingredientService.createManualIngredient(
      auth.supabase,
      auth.userId,
      input
    )
    return NextResponse.json({ food }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
