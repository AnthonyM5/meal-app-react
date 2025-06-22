#!/usr/bin/env node

/**
 * Optimized USDA Bulk Import Script
 *
 * This script uses ONLY the /foods/list endpoint to import foods,
 * since it already contains all the nutrient data we need.
 * This reduces API usage by ~5x compared to the list+batch approach.
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { getFoodsList } from '../lib/usda-integration'

// Load config
const configPath = path.resolve(__dirname, 'import.config.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
const { NUTRIENT_IDS } = config

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const USDA_API_KEY = process.env.NEXT_PUBLIC_USDA_API_KEY

console.log('--- Environment Variables Status ---')
console.log(`NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? 'Loaded' : 'NOT FOUND'}`)
console.log(
  `SUPABASE_SERVICE_ROLE_KEY: ${serviceRoleKey ? 'Loaded' : 'NOT FOUND'}`
)
console.log(
  `NEXT_PUBLIC_USDA_API_KEY: ${USDA_API_KEY ? 'Loaded' : 'NOT FOUND'}`
)

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

if (!USDA_API_KEY || USDA_API_KEY === 'DEMO_KEY') {
  console.error(
    '❌ NEXT_PUBLIC_USDA_API_KEY not found. Please add it to your .env.local file'
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  db: {
    schema: 'public',
  },
})

// Configuration
const PAGES_TO_FETCH = 41 // Maximum pages (end of USDA data)
const START_PAGE = 26 // Continue from where we left off
const PAGE_SIZE = 200 // Max items per page (USDA limit)

async function optimizedBulkImport() {
  console.log('🚀 Starting OPTIMIZED bulk food import from USDA...')
  console.log('📈 Strategy: Using ONLY /foods/list endpoint (5x more efficient!)')

  let totalImported = 0
  let totalUpdated = 0
  let totalErrors = 0
  let totalSkipped = 0

  for (let page = START_PAGE; page <= PAGES_TO_FETCH; page++) {
    console.log(
      `\n📄 Processing page ${page} of ${PAGES_TO_FETCH} (starting from page ${START_PAGE})...`
    )

    try {
      // Fetch foods from list endpoint (contains all nutrient data!)
      const foods = await getFoodsList(page, PAGE_SIZE)

      if (!foods || !Array.isArray(foods) || foods.length === 0) {
        console.log(`⚠️  No more foods available after page ${page - 1}. Ending import.`)
        break // Exit the loop as we've reached the end of data
      }

      console.log(`✅ Retrieved ${foods.length} foods from list endpoint`)

      // Process and upsert foods directly (no additional API calls needed!)
      const { imported, updated, errors, skipped } = await processFoodsDirect(
        foods
      )

      totalImported += imported
      totalUpdated += updated
      totalErrors += errors
      totalSkipped += skipped

      console.log(
        `📊 Page ${page}: +${imported} imported, ~${updated} updated, ×${errors} errors, ↷${skipped} skipped`
      )

      // Rate limiting - be nice to the API
      if (page < PAGES_TO_FETCH) {
        console.log('⏱️  Waiting 1 second...')
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    } catch (error) {
      console.error(`❌ Error processing page ${page}:`, error)
      totalErrors++
    }
  }

  console.log('\n🎉 OPTIMIZED BULK IMPORT COMPLETED!')
  console.log('='.repeat(50))
  console.log(`📊 FINAL RESULTS:`)
  console.log(`✅ Foods imported: ${totalImported}`)
  console.log(`🔄 Foods updated: ${totalUpdated}`)
  console.log(`↷  Foods skipped: ${totalSkipped}`)
  console.log(`❌ Errors: ${totalErrors}`)
  console.log(
    `📈 Total processed: ${
      totalImported + totalUpdated + totalSkipped + totalErrors
    }`
  )
  console.log(
    `🚀 API Efficiency: ${PAGES_TO_FETCH} requests vs ${
      PAGES_TO_FETCH * 5
    } with old method`
  )
}

async function processFoodsDirect(foods: any[]) {
  let imported = 0
  let updated = 0
  let errors = 0
  let skipped = 0

  const foodsToUpsert = foods.map(food => {
    // Extract nutrients directly from the list response
    const nutrients = extractNutrients(food.foodNutrients || [])

    // Determine serving info
    let servingSize = 100
    let servingUnit = 'g'

    if (food.servingSize && food.servingSizeUnit) {
      servingSize = food.servingSize
      servingUnit = food.servingSizeUnit
    }

    return {
      fdc_id: food.fdcId,
      name: food.description,
      brand: food.brandOwner || food.brandName || 'USDA',
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
    }
  })

  if (foodsToUpsert.length > 0) {
    console.log(
      `📦 Upserting ${foodsToUpsert.length} foods directly from list data...`
    )

    try {
      const { data, error, count } = await supabase
        .from('foods')
        .upsert(foodsToUpsert, {
          onConflict: 'fdc_id',
          ignoreDuplicates: false,
        })
        .select('id')

      if (error) {
        console.error('❌ Supabase upsert error:', error)
        errors = foodsToUpsert.length
      } else {
        // Since we can't easily distinguish between inserts/updates with upsert,
        // we'll count them all as imported for simplicity
        imported = foodsToUpsert.length
        console.log(`✅ Successfully processed ${foodsToUpsert.length} foods`)
      }
    } catch (error) {
      console.error('❌ Database operation failed:', error)
      errors = foodsToUpsert.length
    }
  }

  return { imported, updated, errors, skipped }
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

  foodNutrients.forEach(nutrient => {
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

// Run the optimized import
optimizedBulkImport().catch(console.error)
