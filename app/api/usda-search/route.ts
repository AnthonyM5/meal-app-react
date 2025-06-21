import { searchUSDAFoods } from '@/lib/usda-integration'
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query || query.length < 2) {
    return NextResponse.json({ foods: [] })
  }

  try {
    const foods = await searchUSDAFoods(query)
    console.log(foods)
    return NextResponse.json({ foods })
  } catch (error) {
    console.error('USDA search API error:', error)
    return NextResponse.json(
      { error: 'Failed to search USDA database' },
      { status: 500 }
    )
  }
}
