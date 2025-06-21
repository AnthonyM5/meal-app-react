'use server'

import { createClient } from '@/lib/supabase/server'

// USDA FoodData Central API types
interface USDAFood {
  fdcId: number
  description: string
  brandOwner?: string
  brandName?: string
  ingredients?: string
  servingSize?: number
  servingSizeUnit?: string
  householdServingFullText?: string
  foodNutrients: USDANutrient[]
  foodCategory?: {
    description: string
  }
  dataType: string
}

interface USDANutrient {
  nutrientId: number
  nutrientName: string
  nutrientNumber: string
  unitName: string
  value: number
}

interface USDASearchResult {
  foods: USDAFood[]
  totalHits: number
  currentPage: number
  totalPages: number
}

// USDA API configuration
const USDA_API_KEY = process.env.USDA_API_KEY || 'DEMO_KEY'
const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1'

// Nutrient ID mappings for USDA API
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

export async function searchUSDAFoods(
  query: string,
  pageSize = 25
): Promise<USDAFood[]> {
  if (!query || query.length < 2) return []

  try {
    const url = `${USDA_BASE_URL}/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(
      query
    )}&pageSize=${pageSize}&dataType=Branded,Foundation,SR%20Legacy`

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`USDA API error: ${response.status}`)
    }

    const data: USDASearchResult = await response.json()
    return data.foods || []
  } catch (error) {
    console.error('USDA API search error:', error)
    return []
  }
}

export async function importUSDAFood(fdcId: number) {
  const supabase =
    createClient() as import('@supabase/supabase-js').SupabaseClient

  try {
    // Get detailed food information from USDA
    const url = `${USDA_BASE_URL}/food/${fdcId}?api_key=${USDA_API_KEY}&nutrients=${Object.values(
      NUTRIENT_IDS
    ).join(',')}`

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`USDA API error: ${response.status}`)
    }

    const usdaFood: USDAFood = await response.json()

    // Extract nutrition values
    const nutrients = extractNutrients(usdaFood.foodNutrients)

    // Determine serving size (default to 100g if not specified)
    let servingSize = 100
    let servingUnit = 'g'

    if (usdaFood.servingSize && usdaFood.servingSizeUnit) {
      servingSize = usdaFood.servingSize
      servingUnit = usdaFood.servingSizeUnit
    } else if (usdaFood.householdServingFullText) {
      servingUnit = usdaFood.householdServingFullText
    }

    // Check if food already exists by fdc_id
    const { data: existingFood } = await supabase
      .from('foods')
      .select('id')
      .eq('fdc_id', usdaFood.fdcId)
      .single()

    if (existingFood) {
      return { success: true, message: 'Food already exists in database' }
    }

    // Insert the food into our database
    const { error } = await supabase.from('foods').insert({
      fdc_id: usdaFood.fdcId,
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
      is_verified: true, // USDA data is considered verified
    })

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    return { success: true, message: 'Food imported successfully' }
  } catch (error) {
    console.error('Import error:', error)
    throw new Error('Failed to import food from USDA database')
  }
}

function extractNutrients(foodNutrients: USDANutrient[]) {
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
        nutrients.calories = nutrient.value
        break
      case NUTRIENT_IDS.PROTEIN:
        nutrients.protein = nutrient.value
        break
      case NUTRIENT_IDS.CARBS:
        nutrients.carbs = nutrient.value
        break
      case NUTRIENT_IDS.FAT:
        nutrients.fat = nutrient.value
        break
      case NUTRIENT_IDS.FIBER:
        nutrients.fiber = nutrient.value
        break
      case NUTRIENT_IDS.SUGAR:
        nutrients.sugar = nutrient.value
        break
      case NUTRIENT_IDS.SODIUM:
        nutrients.sodium = nutrient.value
        break
      case NUTRIENT_IDS.CHOLESTEROL:
        nutrients.cholesterol = nutrient.value
        break
      case NUTRIENT_IDS.VITAMIN_A:
        nutrients.vitaminA = nutrient.value
        break
      case NUTRIENT_IDS.VITAMIN_C:
        nutrients.vitaminC = nutrient.value
        break
      case NUTRIENT_IDS.CALCIUM:
        nutrients.calcium = nutrient.value
        break
      case NUTRIENT_IDS.IRON:
        nutrients.iron = nutrient.value
        break
    }
  })

  return nutrients
}

export async function bulkImportPopularFoods() {
  const popularFoods = [
    'banana',
    'apple',
    'chicken breast',
    'salmon',
    'broccoli',
    'spinach',
    'brown rice',
    'quinoa',
    'oatmeal',
    'greek yogurt',
    'almonds',
    'avocado',
    'sweet potato',
    'eggs',
    'milk',
    'bread',
    'pasta',
    'ground beef',
    'tuna',
    'carrots',
    'tomato',
    'onion',
    'garlic',
    'olive oil',
    'cheese',
  ]

  const results = []

  for (const food of popularFoods) {
    try {
      const usdaFoods = await searchUSDAFoods(food, 3)

      for (const usdaFood of usdaFoods.slice(0, 2)) {
        // Import top 2 results per search
        try {
          const result = await importUSDAFood(usdaFood.fdcId)
          results.push({ food: usdaFood.description, ...result })

          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (error) {
          console.error(`Failed to import ${usdaFood.description}:`, error)
          results.push({
            food: usdaFood.description,
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }
    } catch (error) {
      console.error(`Failed to search for ${food}:`, error)
    }
  }

  return results
}
