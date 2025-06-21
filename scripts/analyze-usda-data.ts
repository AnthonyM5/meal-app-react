#!/usr/bin/env node

/**
 * USDA API Data Analysis Script
 *
 * This script analyzes the data structure from different USDA API endpoints
 * to determine if we can optimize our import strategy.
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { getFoodDetailsBatch, getFoodsList } from '../lib/usda-integration'

async function analyzeUSDAData() {
  console.log('🔍 Analyzing USDA API data structure...\n')

  try {
    // Test foods/list endpoint
    console.log('📋 Testing /foods/list endpoint...')
    const listData = await getFoodsList(1, 5) // Get just 5 items

    if (!listData || listData.length === 0) {
      console.log('❌ No data returned from foods/list')
      return
    }

    console.log(`✅ Retrieved ${listData.length} foods from list endpoint`)
    console.log('\n📊 Sample food from /foods/list:')
    console.log(JSON.stringify(listData[0], null, 2))

    // Extract FDC IDs for batch test
    const fdcIds = listData.slice(0, 3).map((food: any) => food.fdcId)
    console.log(
      `\n🧪 Testing batch endpoint with FDC IDs: ${fdcIds.join(', ')}`
    )

    // Test foods batch endpoint
    const batchData = await getFoodDetailsBatch(fdcIds, [
      1008, // Energy (calories)
      1003, // Protein
      1005, // Carbs
      1004, // Fat
      1079, // Fiber
      1087, // Calcium
      1089, // Iron
      1162, // Vitamin C
      1104, // Vitamin A
      1242, // Folate
      1109, // Vitamin E
      1095, // Zinc
      1090, // Magnesium
      1092, // Potassium
      1114, // Vitamin D
      1178, // Vitamin B12
    ])

    console.log(`✅ Retrieved ${batchData.length} foods from batch endpoint`)
    if (batchData.length > 0) {
      console.log('\n📊 Sample food from /foods batch:')
      console.log(JSON.stringify(batchData[0], null, 2))
    }

    // Compare nutrient availability
    console.log('\n🔍 NUTRIENT AVAILABILITY COMPARISON:')

    console.log('\n--- Foods/List Response ---')
    const listFood = listData[0]
    if (listFood.foodNutrients) {
      console.log(
        `✅ Has foodNutrients array with ${listFood.foodNutrients.length} nutrients`
      )
      console.log(
        'Available nutrients:',
        listFood.foodNutrients
          .slice(0, 5)
          .map(
            (n: any) =>
              `${n.nutrientName} (${n.nutrientId}): ${n.value} ${n.unitName}`
          )
      )
    } else {
      console.log('❌ No foodNutrients in list response')
    }

    console.log('\n--- Foods/Batch Response ---')
    const batchFood = batchData[0]
    if (batchFood?.foodNutrients) {
      console.log(
        `✅ Has foodNutrients array with ${batchFood.foodNutrients.length} nutrients`
      )
      console.log(
        'Available nutrients:',
        batchFood.foodNutrients
          .slice(0, 5)
          .map(
            (n: any) =>
              `${n.nutrient?.name} (${n.nutrient?.id}): ${n.amount} ${n.nutrient?.unitName}`
          )
      )
    } else {
      console.log('❌ No foodNutrients in batch response')
    }

    // API Usage Analysis
    console.log('\n📊 API USAGE ANALYSIS:')
    console.log(`\nScenario 1 (Current): List + Batch`)
    console.log(`- 1 request to /foods/list (200 foods)`)
    console.log(`- X requests to /foods batch (200 foods ÷ batch_size)`)
    console.log(`- With batch_size=50: 1 + 4 = 5 requests per 200 foods`)
    console.log(`- Rate: 40 foods per request`)

    console.log(`\nScenario 2 (List Only):`)
    console.log(`- 1 request to /foods/list (200 foods)`)
    console.log(`- Rate: 200 foods per request`)
    console.log(`- 5x more efficient IF list contains sufficient nutrients`)
  } catch (error) {
    console.error('❌ Analysis failed:', error)
  }
}

// Run analysis
analyzeUSDAData()
