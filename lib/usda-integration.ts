const USDA_API_KEY =
  process.env.USDA_API_KEY || process.env.NEXT_PUBLIC_USDA_API_KEY || 'DEMO_KEY'
const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1'

export interface USDAFood {
  fdcId: number
  description: string
  brandOwner?: string
  brandName?: string
  foodNutrients: Array<{
    nutrientId: number
    nutrientName: string
    value: number
    unitName: string
  }>
}

export async function searchUSDAFoods(
  query: string,
  pageSize = 25
): Promise<USDAFood[]> {
  try {
    const response = await fetch(
      `${USDA_BASE_URL}/foods/search?query=${encodeURIComponent(
        query
      )}&pageSize=${pageSize}&dataType=Foundation,SR%20Legacy,Branded`,
      {
        headers: {
          'X-Api-Key': USDA_API_KEY,
        },
      }
    )

    if (!response.ok) {
      throw new Error(
        `USDA API error: ${response.status} ${await response.text()}`
      )
    }

    const data = await response.json()
    return data.foods || []
  } catch (error) {
    console.error('USDA search error:', error)
    return []
  }
}

export async function getFoodsList(
  pageNumber: number,
  pageSize = 200,
  dataTypes: string[] = ['Foundation', 'SR Legacy']
): Promise<any[]> {
  const apiKey =
    process.env.USDA_API_KEY || process.env.NEXT_PUBLIC_USDA_API_KEY
  if (!apiKey) {
    throw new Error('USDA API key is not configured.')
  }

  const params = new URLSearchParams({
    pageSize: pageSize.toString(),
    pageNumber: pageNumber.toString(),
  })
  dataTypes.forEach(dt => params.append('dataType', dt))

  const url = `${USDA_BASE_URL}/foods/list?${params.toString()}`

  try {
    const response = await fetch(url, {
      headers: {
        'X-Api-Key': apiKey,
      },
    })

    if (!response.ok) {
      throw new Error(
        `USDA API error: ${response.status} ${await response.text()}`
      )
    }

    return response.json()
  } catch (error) {
    console.error(`Error fetching USDA list from ${url}:`, error)
    return []
  }
}

export async function getFoodDetailsBatch(
  fdcIds: number[],
  nutrientIds: number[]
): Promise<USDAFood[]> {
  if (fdcIds.length === 0) {
    return []
  }
  const response = await fetch(`${USDA_BASE_URL}/foods`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': USDA_API_KEY,
    },
    body: JSON.stringify({
      fdcIds,
      format: 'full',
      nutrients: nutrientIds,
    }),
  })

  if (!response.ok) {
    throw new Error(
      `USDA API error on batch fetch: ${
        response.status
      } ${await response.text()}`
    )
  }

  return response.json()
}

export async function getUSDAFoodDetails(
  fdcId: number
): Promise<USDAFood | null> {
  try {
    const response = await fetch(`${USDA_BASE_URL}/food/${fdcId}`, {
      headers: {
        'X-Api-Key': USDA_API_KEY,
      },
    })

    if (!response.ok) {
      throw new Error(`USDA API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('USDA details error:', error)
    return null
  }
}

export function convertUSDAToFood(usdaFood: USDAFood): any {
  const nutrients = usdaFood.foodNutrients.reduce(
    (acc, nutrient) => {
      switch (nutrient.nutrientId) {
        case 1008: // Energy (calories)
          acc.calories = nutrient.value
          break
        case 1003: // Protein
          acc.protein = nutrient.value
          break
        case 1005: // Carbs
          acc.carbs = nutrient.value
          break
        case 1004: // Fat
          acc.fat = nutrient.value
          break
        case 1079: // Fiber
          acc.fiber = nutrient.value
          break
      }
      return acc
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  )

  return {
    name: usdaFood.description,
    brand: usdaFood.brandOwner || usdaFood.brandName || null,
    serving_size: 100,
    serving_unit: 'g',
    calories_per_serving: nutrients.calories,
    protein_g: nutrients.protein,
    carbs_g: nutrients.carbs,
    fat_g: nutrients.fat,
    fiber_g: nutrients.fiber,
    is_verified: true,
  }
}
