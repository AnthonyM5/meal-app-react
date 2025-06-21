import { createClient } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'

// USDA API configuration
const USDA_API_KEY = process.env.USDA_API_KEY || 'DEMO_KEY'
const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const NUTRIENT_IDS = {
  ENERGY: 1008, // Energy (calories)
  PROTEIN: 1003, // Protein
  CARBS: 1005, // Carbohydrate, by difference
  FAT: 1004, // Total lipid (fat)
  FIBER: 1079, // Fiber, total dietary
  SUGAR: 2000, // Sugars, total including NLEA
  SODIUM: 1093, // Sodium, Na
  CHOLESTEROL: 1253, // Cholesterol
  VITAMIN_A: 1106, // Vitamin A, RAE
  VITAMIN_C: 1162, // Vitamin C, total ascorbic acid
  CALCIUM: 1087, // Calcium, Ca
  IRON: 1089, // Iron, Fe
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()

    if (!query || query.length < 2) {
      return NextResponse.json({ imported: 0, message: 'Query too short' })
    }

    let importedCount = 0

    // Search USDA database
    const usdaFoods = await searchUSDAFoods(query)

    for (const usdaFood of usdaFoods.slice(0, 10)) {
      // Limit to top 10 results
      try {
        const imported = await importUSDAFoodToDatabase(usdaFood, supabase)
        if (imported) importedCount++

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50))
      } catch (error) {
        console.error(`Failed to import ${usdaFood.description}:`, error)
      }
    }

    // TODO: Add more food APIs here (OpenFoodFacts, Edamam, etc.)

    return NextResponse.json({
      imported: importedCount,
      message: `Imported ${importedCount} new foods`,
    })
  } catch (error) {
    console.error('Import external foods error:', error)
    return NextResponse.json(
      { imported: 0, error: 'Failed to import foods' },
      { status: 500 }
    )
  }
}

async function searchUSDAFoods(query: string) {
  try {
    const url = `${USDA_BASE_URL}/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(
      query
    )}&pageSize=15&dataType=Branded,Foundation,SR%20Legacy`

    const response = await fetch(url)
    if (!response.ok) return []

    const data = await response.json()
    return data.foods || []
  } catch (error) {
    console.error('USDA search error:', error)
    return []
  }
}

async function importUSDAFoodToDatabase(usdaFood: any, supabase: any) {
  try {
    // Check if food already exists
    const { data: existingFood } = await supabase
      .from('foods')
      .select('id')
      .eq('name', usdaFood.description)
      .eq('brand', usdaFood.brandOwner || usdaFood.brandName || 'USDA')
      .single()

    if (existingFood) {
      return false // Already exists
    }

    // Get detailed nutrition info
    const detailResponse = await fetch(
      `${USDA_BASE_URL}/food/${
        usdaFood.fdcId
      }?api_key=${USDA_API_KEY}&nutrients=${Object.values(NUTRIENT_IDS).join(
        ','
      )}`
    )

    if (!detailResponse.ok) return false

    const detailData = await detailResponse.json()
    const nutrients = extractNutrients(detailData.foodNutrients || [])

    // Determine serving size
    let servingSize = 100
    let servingUnit = 'g'

    if (detailData.servingSize && detailData.servingSizeUnit) {
      servingSize = detailData.servingSize
      servingUnit = detailData.servingSizeUnit
    }

    // Insert into database
    const { error } = await supabase.from('foods').insert({
      name: usdaFood.description,
      brand: usdaFood.brandOwner || usdaFood.brandName || 'USDA',
      serving_size: servingSize,
      serving_unit: servingUnit,
      calories_per_serving: nutrients.calories,
      protein_g: nutrients.protein,
      carbs_g: nutrients.carbs,
      fat_g: nutrients.fat,
      fiber_g: nutrients.fiber,
      sugar_g: nutrients.sugar,
      sodium_mg: nutrients.sodium,
      cholesterol_mg: nutrients.cholesterol,
      vitamin_a_mcg: nutrients.vitaminA,
      vitamin_c_mg: nutrients.vitaminC,
      calcium_mg: nutrients.calcium,
      iron_mg: nutrients.iron,
      is_verified: true,
    })

    return !error
  } catch (error) {
    console.error('Import food error:', error)
    return false
  }
}

function extractNutrients(foodNutrients: any[]) {
  const nutrients = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
    cholesterol: 0,
    vitaminA: 0,
    vitaminC: 0,
    calcium: 0,
    iron: 0,
  }

  foodNutrients.forEach(nutrient => {
    switch (nutrient.nutrientId) {
      case NUTRIENT_IDS.ENERGY:
        nutrients.calories = nutrient.value || 0
        break
      case NUTRIENT_IDS.PROTEIN:
        nutrients.protein = nutrient.value || 0
        break
      case NUTRIENT_IDS.CARBS:
        nutrients.carbs = nutrient.value || 0
        break
      case NUTRIENT_IDS.FAT:
        nutrients.fat = nutrient.value || 0
        break
      case NUTRIENT_IDS.FIBER:
        nutrients.fiber = nutrient.value || 0
        break
      case NUTRIENT_IDS.SUGAR:
        nutrients.sugar = nutrient.value || 0
        break
      case NUTRIENT_IDS.SODIUM:
        nutrients.sodium = nutrient.value || 0
        break
      case NUTRIENT_IDS.CHOLESTEROL:
        nutrients.cholesterol = nutrient.value || 0
        break
      case NUTRIENT_IDS.VITAMIN_A:
        nutrients.vitaminA = nutrient.value || 0
        break
      case NUTRIENT_IDS.VITAMIN_C:
        nutrients.vitaminC = nutrient.value || 0
        break
      case NUTRIENT_IDS.CALCIUM:
        nutrients.calcium = nutrient.value || 0
        break
      case NUTRIENT_IDS.IRON:
        nutrients.iron = nutrient.value || 0
        break
    }
  })

  return nutrients
}
