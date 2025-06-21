#!/usr/bin/env node

/**
 * Test script to verify database schema and then run a small import
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testSchema() {
  console.log('🔍 Testing database schema...')

  try {
    // Test if we can insert a food with fdc_id
    const testFood = {
      fdc_id: 999999, // Test FDC ID
      name: 'Test Food',
      brand: 'Test Brand',
      serving_size: 100,
      serving_unit: 'g',
      calories_per_serving: 100,
      protein_g: 10,
      carbs_g: 20,
      fat_g: 5,
      fiber_g: 3,
      is_verified: true,
    }

    console.log('📝 Testing food insert with fdc_id...')
    const { data, error } = await supabase
      .from('foods')
      .insert(testFood)
      .select()

    if (error) {
      console.error('❌ Schema test failed:', error)
      return false
    }

    console.log('✅ Schema test passed! fdc_id column exists')

    // Clean up test data
    await supabase.from('foods').delete().eq('fdc_id', 999999)

    return true
  } catch (error) {
    console.error('❌ Schema test error:', error)
    return false
  }
}

async function runMiniImport() {
  console.log('\n🚀 Running mini USDA import (1 page)...')

  const USDA_API_KEY = process.env.NEXT_PUBLIC_USDA_API_KEY!
  const url = `https://api.nal.usda.gov/fdc/v1/foods/list?pageSize=5&pageNumber=1&dataType=Foundation`

  try {
    const response = await fetch(url, {
      headers: {
        'X-Api-Key': USDA_API_KEY,
      },
    })

    if (!response.ok) {
      throw new Error(`USDA API error: ${response.status}`)
    }

    const foods = await response.json()
    console.log(`📥 Retrieved ${foods.length} foods from USDA API`)

    if (foods.length === 0) {
      console.log('⚠️  No foods returned')
      return
    }

    // Process first food only
    const food = foods[0]
    console.log(`🍎 Processing: ${food.description}`)

    const foodToInsert = {
      fdc_id: food.fdcId,
      name: food.description.slice(0, 255),
      brand: 'USDA',
      serving_size: 100,
      serving_unit: 'g',
      calories_per_serving: 0, // Will be updated when we extract nutrients
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
      is_verified: true,
    }

    const { data, error } = await supabase.from('foods').upsert(foodToInsert, {
      onConflict: 'fdc_id',
      ignoreDuplicates: false,
    })

    if (error) {
      console.error('❌ Import failed:', error)
    } else {
      console.log('✅ Successfully imported 1 food!')
    }
  } catch (error) {
    console.error('❌ Mini import failed:', error)
  }
}

async function main() {
  const schemaOk = await testSchema()

  if (schemaOk) {
    await runMiniImport()
    console.log(
      '\n🎉 Test completed! Database schema is ready for bulk import.'
    )
    console.log('You can now run: npx tsx scripts/rate-limited-import.ts')
  } else {
    console.log('\n❌ Schema test failed. Check database migrations.')
  }
}

main().catch(console.error)
