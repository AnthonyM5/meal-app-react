import { authenticateRequest, errorResponse } from '@/lib/server/rest-auth'
import * as ingredientService from '@/lib/services/ingredient-service'
import { type NextRequest, NextResponse } from 'next/server'

// Mobile-facing REST wrapper over lib/services/ingredient-service.ts —
// mirrors acceptBrandedIngredient in lib/ingredient-actions.ts for a caller
// with no cookies.

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { code } = (await request.json()) as { code?: string }
    if (!code) {
      return NextResponse.json({ error: 'code is required' }, { status: 400 })
    }
    const food = await ingredientService.acceptBrandedIngredient(
      auth.supabase,
      code
    )
    return NextResponse.json({ food }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
