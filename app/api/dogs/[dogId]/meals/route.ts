import { authenticateRequest, errorResponse } from '@/lib/server/rest-auth'
import * as mealService from '@/lib/services/meal-service'
import type { MealSource, MealType } from '@/lib/types'
import { type NextRequest, NextResponse } from 'next/server'

// Mobile-facing REST wrapper over lib/services/meal-service.ts — mirrors
// getDogMeals/createDogMeal in lib/meal-actions.ts for a caller with no
// cookies (revalidatePath is a web-only concern and has no REST equivalent).

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dogId: string }> }
) {
  const auth = await authenticateRequest(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { dogId } = await params
    const date = request.nextUrl.searchParams.get('date') ?? undefined
    const meals = await mealService.getDogMeals(
      auth.supabase,
      auth.userId,
      dogId,
      date
    )
    return NextResponse.json({ meals })
  } catch (error) {
    return errorResponse(error)
  }
}

interface CreateMealBody {
  meal_type: MealType
  items: mealService.DogMealItemInput[]
  source?: MealSource
  name?: string
  date?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dogId: string }> }
) {
  const auth = await authenticateRequest(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { dogId } = await params
    const body = (await request.json()) as CreateMealBody
    const result = await mealService.createDogMeal(
      auth.supabase,
      auth.userId,
      dogId,
      body.meal_type,
      body.items,
      { source: body.source, name: body.name, date: body.date }
    )
    return NextResponse.json({ result }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
