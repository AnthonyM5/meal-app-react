import { convertUSDAToIngredient } from '@/lib/usda-canine'
import type { Database } from '@/lib/types'
import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

// USDA API configuration
const USDA_API_KEY =
  process.env.USDA_API_KEY || process.env.NEXT_PUBLIC_USDA_API_KEY || 'DEMO_KEY'
const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1'

function isSupabaseConfigured(): boolean {
  return !!(
    typeof process.env.NEXT_PUBLIC_SUPABASE_URL === 'string' &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
    typeof process.env.SUPABASE_SERVICE_ROLE_KEY === 'string' &&
    process.env.SUPABASE_SERVICE_ROLE_KEY.length > 0
  )
}

function createSupabaseClient() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase environment variables not configured')
  }

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get: () => undefined,
        set: () => {},
        remove: () => {},
      },
    }
  )
}

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { imported: 0, error: 'Database not configured' },
        { status: 503 }
      )
    }

    const supabase = createSupabaseClient()
    const { query } = await request.json()

    if (!query || query.length < 2) {
      return NextResponse.json({ imported: 0, message: 'Query too short' })
    }

    let importedCount = 0
    let flaggedToxic = 0

    const usdaFoods = await searchUSDAFoods(query)

    for (const usdaFood of usdaFoods.slice(0, 10)) {
      try {
        const result = await importIngredient(usdaFood, supabase)
        if (result.imported) importedCount++
        if (result.toxic) flaggedToxic++

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50))
      } catch (error) {
        console.error(`Failed to import ${usdaFood.description}:`, error)
      }
    }

    return NextResponse.json({
      imported: importedCount,
      flaggedToxic,
      message: `Imported ${importedCount} new ingredients${
        flaggedToxic ? ` (${flaggedToxic} flagged unsafe for dogs)` : ''
      }`,
    })
  } catch (error) {
    console.error('Import ingredients error:', error)
    return NextResponse.json(
      { imported: 0, error: 'Failed to import ingredients' },
      { status: 500 }
    )
  }
}

async function searchUSDAFoods(query: string) {
  try {
    // Foundation / SR Legacy carry the fullest nutrient profiles —
    // prefer them over Branded for whole-food ingredients.
    const url = `${USDA_BASE_URL}/foods/search?query=${encodeURIComponent(
      query
    )}&pageSize=15&dataType=Foundation,SR%20Legacy`

    const response = await fetch(url, { headers: { 'X-Api-Key': USDA_API_KEY } })
    if (!response.ok) return []

    const data = await response.json()
    return data.foods || []
  } catch (error) {
    console.error('USDA search error:', error)
    return []
  }
}

async function importIngredient(
  usdaFood: { fdcId: number; description: string },
  supabase: ReturnType<typeof createSupabaseClient>
): Promise<{ imported: boolean; toxic: boolean }> {
  // Dedupe on USDA FDC id
  const { data: existing } = await supabase
    .from('foods')
    .select('id')
    .eq('fdc_id', usdaFood.fdcId)
    .maybeSingle()

  if (existing) return { imported: false, toxic: false }

  // format=full exposes the complete nutrient.id/amount pairs
  const detailResponse = await fetch(
    `${USDA_BASE_URL}/food/${usdaFood.fdcId}?format=full`,
    { headers: { 'X-Api-Key': USDA_API_KEY } }
  )
  if (!detailResponse.ok) return { imported: false, toxic: false }

  const detail = await detailResponse.json()
  const row = convertUSDAToIngredient(detail)

  const { error } = await supabase.from('foods').insert(row)
  if (error) {
    console.error('Insert ingredient error:', error)
    return { imported: false, toxic: false }
  }

  return { imported: true, toxic: !row.is_safe_for_dogs }
}
