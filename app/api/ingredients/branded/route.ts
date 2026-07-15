import { authenticateRequest, errorResponse, readJson } from '@/lib/server/rest-auth'
import { BrandedIngredientSchema } from '@/lib/server/rest-schemas'
import * as ingredientService from '@/lib/services/ingredient-service'
import { type NextRequest, NextResponse } from 'next/server'

// Mobile-facing REST wrapper over lib/services/ingredient-service.ts —
// mirrors acceptBrandedIngredient in lib/ingredient-actions.ts for a caller
// with no cookies.

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await readJson(request, BrandedIngredientSchema)
    if (body instanceof NextResponse) return body
    const food = await ingredientService.acceptBrandedIngredient(
      auth.supabase,
      body.code
    )
    return NextResponse.json({ food }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
