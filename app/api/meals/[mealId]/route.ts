import { authenticateRequest, errorResponse, readJson } from '@/lib/server/rest-auth'
import { MealUpdateSchema } from '@/lib/server/rest-schemas'
import * as mealService from '@/lib/services/meal-service'
import { type NextRequest, NextResponse } from 'next/server'

// Mobile-facing REST wrapper over lib/services/meal-service.ts — mirrors
// getDogMealForEdit/updateDogMeal/deleteDogMeal in lib/meal-actions.ts for a
// caller with no cookies.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mealId: string }> }
) {
  const auth = await authenticateRequest(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { mealId } = await params
    const meal = await mealService.getDogMealForEdit(
      auth.supabase,
      auth.userId,
      mealId
    )
    return NextResponse.json({ meal })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ mealId: string }> }
) {
  const auth = await authenticateRequest(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { mealId } = await params
    const body = await readJson(request, MealUpdateSchema)
    if (body instanceof NextResponse) return body
    const result = await mealService.updateDogMeal(
      auth.supabase,
      auth.userId,
      mealId,
      body.meal_type,
      body.items,
      { name: body.name }
    )
    return NextResponse.json({ result })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ mealId: string }> }
) {
  const auth = await authenticateRequest(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { mealId } = await params
    await mealService.deleteDogMeal(auth.supabase, auth.userId, mealId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}
