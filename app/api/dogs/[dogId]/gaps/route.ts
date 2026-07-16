import { authenticateRequest, errorResponse } from '@/lib/server/rest-auth'
import * as mealService from '@/lib/services/meal-service'
import { type NextRequest, NextResponse } from 'next/server'

// Mobile-facing REST wrapper over lib/services/meal-service.ts — mirrors
// getDogDailyGaps in lib/meal-actions.ts for a caller with no cookies.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dogId: string }> }
) {
  const auth = await authenticateRequest(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { dogId } = await params
    const date = request.nextUrl.searchParams.get('date') ?? undefined
    const gaps = await mealService.getDogDailyGaps(
      auth.supabase,
      auth.userId,
      dogId,
      date
    )
    return NextResponse.json(gaps)
  } catch (error) {
    return errorResponse(error)
  }
}
