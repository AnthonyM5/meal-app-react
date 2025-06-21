#!/usr/bin/env node

/**
 * Rate-Limited USDA Import Script
 *
 * Uses ONLY the /foods/list endpoint for maximum efficiency.
 * Respects the 1,000 requests/hour limit with built-in rate limiting.
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

// Environment setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key to bypass RLS
const USDA_API_KEY = process.env.NEXT_PUBLIC_USDA_API_KEY!

if (!serviceRoleKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY')
  console.log('Please add your service role key to .env.local')
  console.log(
    'You can find it in your Supabase dashboard under Project Settings > API'
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Rate limiting configuration
const MAX_REQUESTS_PER_HOUR = 1000
const PAGES_TO_FETCH = 5 // Conservative limit
const PAGE_SIZE = 200
const DELAY_BETWEEN_REQUESTS = 4000 // 4 seconds = 900 requests/hour (safe buffer)

// USDA nutrient number mapping (from list endpoint format)
const NUTRIENT_NUMBERS = {
  ENERGY: '208', // Energy (kcal)
  PROTEIN: '203', // Protein
  CARBS: '205', // Carbohydrate, by difference
  FAT: '204', // Total lipid (fat)
  FIBER: '291', // Fiber, total dietary
  SUGAR: '269', // Total Sugars
  SODIUM: '307', // Sodium, Na
  CHOLESTEROL: '601', // Cholesterol
  VITAMIN_A: '320', // Vitamin A, RAE
  VITAMIN_C: '401', // Vitamin C, total ascorbic acid
  CALCIUM: '301', // Calcium, Ca
  IRON: '303', // Iron, Fe
  POTASSIUM: '306', // Potassium, K
  MAGNESIUM: '304', // Magnesium, Mg
  ZINC: '309', // Zinc, Zn
  SELENIUM: '317', // Selenium, Se
  VITAMIN_D: '328', // Vitamin D (D2 + D3)
  VITAMIN_B12: '418', // Vitamin B-12
  FOLATE: '435', // Folate, DFE
  VITAMIN_E: '323', // Vitamin E (alpha-tocopherol)
}

async function getFoodsListOptimized(pageNumber: number, pageSize = 200) {
  const url = `https://api.nal.usda.gov/fdc/v1/foods/list?pageSize=${pageSize}&pageNumber=${pageNumber}&dataType=Foundation&dataType=SR%20Legacy`

  const response = await fetch(url, {
    headers: {
      'X-Api-Key': USDA_API_KEY,
    },
  })

  if (!response.ok) {
    throw new Error(
      `USDA API error: ${response.status} ${await response.text()}`
    )
  }

  return response.json()
}

function extractNutrientsFromList(foodNutrients: any[]) {
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

  foodNutrients.forEach(nutrient => {
    const value = nutrient.amount || 0
    const number = nutrient.number

    switch (number) {
      case NUTRIENT_NUMBERS.ENERGY:
        nutrients.calories = value
        break
      case NUTRIENT_NUMBERS.PROTEIN:
        nutrients.protein = value
        break
      case NUTRIENT_NUMBERS.CARBS:
        nutrients.carbs = value
        break
      case NUTRIENT_NUMBERS.FAT:
        nutrients.fat = value
        break
      case NUTRIENT_NUMBERS.FIBER:
        nutrients.fiber = value
        break
      case NUTRIENT_NUMBERS.SUGAR:
        nutrients.sugar = value
        break
      case NUTRIENT_NUMBERS.SODIUM:
        nutrients.sodium = value
        break
      case NUTRIENT_NUMBERS.CHOLESTEROL:
        nutrients.cholesterol = value
        break
      case NUTRIENT_NUMBERS.VITAMIN_A:
        nutrients.vitaminA = value
        break
      case NUTRIENT_NUMBERS.VITAMIN_C:
        nutrients.vitaminC = value
        break
      case NUTRIENT_NUMBERS.CALCIUM:
        nutrients.calcium = value
        break
      case NUTRIENT_NUMBERS.IRON:
        nutrients.iron = value
        break
      case NUTRIENT_NUMBERS.POTASSIUM:
        nutrients.potassium = value
        break
      case NUTRIENT_NUMBERS.MAGNESIUM:
        nutrients.magnesium = value
        break
      case NUTRIENT_NUMBERS.ZINC:
        nutrients.zinc = value
        break
      case NUTRIENT_NUMBERS.SELENIUM:
        nutrients.selenium = value
        break
      case NUTRIENT_NUMBERS.VITAMIN_D:
        nutrients.vitaminD = value
        break
      case NUTRIENT_NUMBERS.VITAMIN_B12:
        nutrients.vitaminB12 = value
        break
      case NUTRIENT_NUMBERS.FOLATE:
        nutrients.folate = value
        break
      case NUTRIENT_NUMBERS.VITAMIN_E:
        nutrients.vitaminE = value
        break
    }
  })

  return nutrients
}

async function processAndUpsertFoods(foods: any[]) {
  console.log(`📦 Processing ${foods.length} foods...`)

  const foodsToUpsert = foods.map(food => {
    const nutrients = extractNutrientsFromList(food.foodNutrients || [])

    return {
      fdc_id: food.fdcId,
      name: food.description.slice(0, 255), // Ensure it fits in database
      brand: (food.brandOwner || food.brandName || 'USDA').slice(0, 255),
      serving_size: 100, // Standard 100g serving
      serving_unit: 'g',
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
    }
  })

  try {
    const { data, error } = await supabase.from('foods').upsert(foodsToUpsert, {
      onConflict: 'fdc_id',
      ignoreDuplicates: false,
    })

    if (error) {
      console.error('❌ Database error:', error)
      return { success: false, processed: 0 }
    }

    console.log(`✅ Successfully processed ${foodsToUpsert.length} foods`)
    return { success: true, processed: foodsToUpsert.length }
  } catch (error) {
    console.error('❌ Upsert failed:', error)
    return { success: false, processed: 0 }
  }
}

async function rateLimitedImport() {
  console.log('🚀 Starting RATE-LIMITED USDA import...')
  console.log(`📊 Configuration:`)
  console.log(`   • Max requests/hour: ${MAX_REQUESTS_PER_HOUR}`)
  console.log(`   • Pages to fetch: ${PAGES_TO_FETCH}`)
  console.log(`   • Page size: ${PAGE_SIZE}`)
  console.log(`   • Delay between requests: ${DELAY_BETWEEN_REQUESTS}ms`)
  console.log(`   • Expected foods: ${PAGES_TO_FETCH * PAGE_SIZE}`)

  let totalProcessed = 0
  let totalErrors = 0
  const startTime = Date.now()

  for (let page = 1; page <= PAGES_TO_FETCH; page++) {
    console.log(`\n📄 Processing page ${page} of ${PAGES_TO_FETCH}...`)

    try {
      // Fetch from list endpoint only
      const foods = await getFoodsListOptimized(page, PAGE_SIZE)

      if (!foods || foods.length === 0) {
        console.log(`⚠️  No foods returned for page ${page}`)
        continue
      }

      console.log(`📥 Retrieved ${foods.length} foods`)

      // Process and upsert
      const { success, processed } = await processAndUpsertFoods(foods)

      if (success) {
        totalProcessed += processed
      } else {
        totalErrors++
      }

      // Rate limiting delay (except for last request)
      if (page < PAGES_TO_FETCH) {
        console.log(
          `⏱️  Rate limiting: waiting ${DELAY_BETWEEN_REQUESTS / 1000}s...`
        )
        await new Promise(resolve =>
          setTimeout(resolve, DELAY_BETWEEN_REQUESTS)
        )
      }
    } catch (error) {
      console.error(`❌ Error on page ${page}:`, error)
      totalErrors++
    }
  }

  const endTime = Date.now()
  const duration = (endTime - startTime) / 1000

  console.log('\n🎉 RATE-LIMITED IMPORT COMPLETED!')
  console.log('='.repeat(50))
  console.log(`✅ Foods processed: ${totalProcessed}`)
  console.log(`❌ Errors: ${totalErrors}`)
  console.log(`⏱️  Duration: ${duration}s`)
  console.log(
    `📊 Rate: ${Math.round((totalProcessed / duration) * 60)} foods/minute`
  )
  console.log(`🌟 API efficiency: 1 request per ${PAGE_SIZE} foods`)
  console.log(
    `🚦 Projected hourly rate: ~${Math.round(
      3600000 / DELAY_BETWEEN_REQUESTS
    )} requests/hour`
  )
}

// Run the import
rateLimitedImport().catch(console.error)
