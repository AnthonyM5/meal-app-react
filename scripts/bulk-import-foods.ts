import { createClient } from "@/lib/supabase/server"

const USDA_API_KEY = process.env.USDA_API_KEY
const USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1"

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
  POTASSIUM: 1092, // Potassium, K
  MAGNESIUM: 1090, // Magnesium, Mg
  ZINC: 1095, // Zinc, Zn
  SELENIUM: 1103, // Selenium, Se
  VITAMIN_D: 1114, // Vitamin D (D2 + D3)
  VITAMIN_B12: 1178, // Vitamin B-12
  FOLATE: 1177, // Folate, total
  VITAMIN_E: 1109, // Vitamin E (alpha-tocopherol)
}

// Popular foods to import
const FOOD_CATEGORIES = [
  // Proteins
  "chicken breast",
  "salmon",
  "tuna",
  "eggs",
  "greek yogurt",
  "cottage cheese",
  "tofu",
  "ground beef",
  "turkey",
  "shrimp",

  // Carbs
  "brown rice",
  "quinoa",
  "oatmeal",
  "sweet potato",
  "banana",
  "apple",
  "bread",
  "pasta",
  "potato",
  "rice",

  // Vegetables
  "broccoli",
  "spinach",
  "kale",
  "carrots",
  "tomato",
  "bell pepper",
  "onion",
  "garlic",
  "cucumber",
  "lettuce",

  // Fats
  "avocado",
  "almonds",
  "walnuts",
  "olive oil",
  "peanut butter",
  "coconut oil",
  "chia seeds",
  "flax seeds",

  // Dairy
  "milk",
  "cheese",
  "yogurt",
  "butter",
  "cream cheese",

  // Fruits
  "orange",
  "strawberry",
  "blueberry",
  "grape",
  "pineapple",
  "mango",
  "watermelon",
  "peach",

  // Grains & Legumes
  "black beans",
  "chickpeas",
  "lentils",
  "kidney beans",
  "pinto beans",
  "barley",
  "bulgur",
]

async function bulkImportFoods() {
  console.log("🚀 Starting bulk food import from USDA...")

  if (!USDA_API_KEY || USDA_API_KEY === "DEMO_KEY") {
    console.error("❌ USDA_API_KEY not found. Please add it to your .env.local file")
    return
  }

  const supabase = createClient()
  let totalImported = 0
  let totalSkipped = 0
  let totalErrors = 0

  for (const category of FOOD_CATEGORIES) {
    console.log(`\n📂 Processing category: ${category}`)

    try {
      // Search for foods in this category
      const foods = await searchUSDAFoods(category, 8) // Get top 8 results per category

      for (const food of foods) {
        try {
          const result = await importFoodToDatabase(food, supabase)

          if (result.success) {
            totalImported++
            console.log(`  ✅ ${food.description}`)
          } else {
            totalSkipped++
            console.log(`  ⏭️  ${food.description} (${result.reason})`)
          }

          // Rate limiting - wait 100ms between requests
          await new Promise((resolve) => setTimeout(resolve, 100))
        } catch (error) {
          totalErrors++
          console.log(`  ❌ ${food.description} - Error: ${error}`)
        }
      }
    } catch (error) {
      console.error(`❌ Failed to process category ${category}:`, error)
    }
  }

  console.log(`\n📊 Import Summary:`)
  console.log(`✅ Successfully imported: ${totalImported}`)
  console.log(`⏭️  Skipped (already exist): ${totalSkipped}`)
  console.log(`❌ Errors: ${totalErrors}`)
  console.log(`📈 Total processed: ${totalImported + totalSkipped + totalErrors}`)
}

async function searchUSDAFoods(query: string, pageSize = 25) {
  const url = `${USDA_BASE_URL}/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(query)}&pageSize=${pageSize}&dataType=Foundation,SR%20Legacy,Branded`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`USDA API error: ${response.status}`)
  }

  const data = await response.json()
  return data.foods || []
}

async function importFoodToDatabase(usdaFood: any, supabase: any) {
  try {
    // Check if food already exists
    const { data: existingFood } = await supabase
      .from("foods")
      .select("id")
      .eq("name", usdaFood.description)
      .eq("brand", usdaFood.brandOwner || usdaFood.brandName || "USDA")
      .single()

    if (existingFood) {
      return { success: false, reason: "already exists" }
    }

    // Get detailed nutrition info
    const detailUrl = `${USDA_BASE_URL}/food/${usdaFood.fdcId}?api_key=${USDA_API_KEY}&nutrients=${Object.values(NUTRIENT_IDS).join(",")}`
    const detailResponse = await fetch(detailUrl)

    if (!detailResponse.ok) {
      return { success: false, reason: "failed to get details" }
    }

    const detailData = await detailResponse.json()
    const nutrients = extractNutrients(detailData.foodNutrients || [])

    // Determine serving size
    let servingSize = 100
    let servingUnit = "g"

    if (detailData.servingSize && detailData.servingSizeUnit) {
      servingSize = detailData.servingSize
      servingUnit = detailData.servingSizeUnit
    }

    // Insert into database
    const { error } = await supabase.from("foods").insert({
      name: usdaFood.description,
      brand: usdaFood.brandOwner || usdaFood.brandName || "USDA",
      serving_size: servingSize,
      serving_unit: servingUnit,
      calories_per_serving: Math.round(nutrients.calories),
      protein_g: Math.round(nutrients.protein * 100) / 100,
      carbs_g: Math.round(nutrients.carbs * 100) / 100,
      fat_g: Math.round(nutrients.fat * 100) / 100,
      fiber_g: Math.round(nutrients.fiber * 100) / 100,
      sugar_g: Math.round(nutrients.sugar * 100) / 100,
      sodium_mg: Math.round(nutrients.sodium),
      cholesterol_mg: Math.round(nutrients.cholesterol),
      vitamin_a_mcg: Math.round(nutrients.vitaminA),
      vitamin_c_mg: Math.round(nutrients.vitaminC * 100) / 100,
      calcium_mg: Math.round(nutrients.calcium),
      iron_mg: Math.round(nutrients.iron * 100) / 100,
      potassium_mg: Math.round(nutrients.potassium),
      magnesium_mg: Math.round(nutrients.magnesium),
      zinc_mg: Math.round(nutrients.zinc * 100) / 100,
      selenium_mcg: Math.round(nutrients.selenium * 100) / 100,
      vitamin_d_mcg: Math.round(nutrients.vitaminD * 100) / 100,
      vitamin_b12_mcg: Math.round(nutrients.vitaminB12 * 100) / 100,
      folate_mcg: Math.round(nutrients.folate),
      vitamin_e_mg: Math.round(nutrients.vitaminE * 100) / 100,
      is_verified: true,
    })

    if (error) {
      return { success: false, reason: `database error: ${error.message}` }
    }

    return { success: true }
  } catch (error) {
    return { success: false, reason: `import error: ${error}` }
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
    potassium: 0,
    magnesium: 0,
    zinc: 0,
    selenium: 0,
    vitaminD: 0,
    vitaminB12: 0,
    folate: 0,
    vitaminE: 0,
  }

  foodNutrients.forEach((nutrient) => {
    const value = nutrient.value || 0
    switch (nutrient.nutrientId) {
      case NUTRIENT_IDS.ENERGY:
        nutrients.calories = value
        break
      case NUTRIENT_IDS.PROTEIN:
        nutrients.protein = value
        break
      case NUTRIENT_IDS.CARBS:
        nutrients.carbs = value
        break
      case NUTRIENT_IDS.FAT:
        nutrients.fat = value
        break
      case NUTRIENT_IDS.FIBER:
        nutrients.fiber = value
        break
      case NUTRIENT_IDS.SUGAR:
        nutrients.sugar = value
        break
      case NUTRIENT_IDS.SODIUM:
        nutrients.sodium = value
        break
      case NUTRIENT_IDS.CHOLESTEROL:
        nutrients.cholesterol = value
        break
      case NUTRIENT_IDS.VITAMIN_A:
        nutrients.vitaminA = value
        break
      case NUTRIENT_IDS.VITAMIN_C:
        nutrients.vitaminC = value
        break
      case NUTRIENT_IDS.CALCIUM:
        nutrients.calcium = value
        break
      case NUTRIENT_IDS.IRON:
        nutrients.iron = value
        break
      case NUTRIENT_IDS.POTASSIUM:
        nutrients.potassium = value
        break
      case NUTRIENT_IDS.MAGNESIUM:
        nutrients.magnesium = value
        break
      case NUTRIENT_IDS.ZINC:
        nutrients.zinc = value
        break
      case NUTRIENT_IDS.SELENIUM:
        nutrients.selenium = value
        break
      case NUTRIENT_IDS.VITAMIN_D:
        nutrients.vitaminD = value
        break
      case NUTRIENT_IDS.VITAMIN_B12:
        nutrients.vitaminB12 = value
        break
      case NUTRIENT_IDS.FOLATE:
        nutrients.folate = value
        break
      case NUTRIENT_IDS.VITAMIN_E:
        nutrients.vitaminE = value
        break
    }
  })

  return nutrients
}

// Run the import
bulkImportFoods().catch(console.error)
