#!/usr/bin/env node

/**
 * Database Cleanup and Schema Verification Script
 *
 * This script will:
 * 1. Clear all existing food records (to avoid conflicts)
 * 2. Verify the foods table has all required columns including fdc_id
 * 3. Show table schema for verification
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables')
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Found' : 'Missing')
  console.log(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY:',
    supabaseAnonKey ? 'Found' : 'Missing'
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function cleanupAndVerify() {
  console.log('🧹 Starting database cleanup and schema verification...\n')

  try {
    // 1. Check current food count
    console.log('📊 Checking current food records...')
    const { count: currentCount, error: countError } = await supabase
      .from('foods')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.error('❌ Error counting foods:', countError)
      return
    }

    console.log(`📈 Current food records: ${currentCount}`)

    // 2. Clear existing foods (if any)
    if (currentCount && currentCount > 0) {
      console.log('\n🗑️  Clearing existing food records...')
      const { error: deleteError } = await supabase
        .from('foods')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

      if (deleteError) {
        console.error('❌ Error deleting foods:', deleteError)
        return
      }
      console.log(`✅ Cleared ${currentCount} food records`)
    } else {
      console.log('✅ No existing food records to clear')
    }

    // 3. Verify schema by checking required columns
    console.log('\n🔍 Verifying foods table schema...')

    const requiredColumns = [
      'id',
      'fdc_id',
      'name',
      'brand',
      'serving_size',
      'serving_unit',
      'calories_per_serving',
      'protein_g',
      'carbs_g',
      'fat_g',
      'fiber_g',
      'sugar_g',
      'sodium_mg',
      'cholesterol_mg',
      'vitamin_a_mcg',
      'vitamin_c_mg',
      'calcium_mg',
      'iron_mg',
      'potassium_mg',
      'magnesium_mg',
      'zinc_mg',
      'selenium_mcg',
      'vitamin_d_mcg',
      'vitamin_b12_mcg',
      'folate_mcg',
      'vitamin_e_mg',
      'is_verified',
      'created_by',
      'created_at',
      'updated_at',
    ]

    // Test insert with all required fields
    const testFood = {
      fdc_id: 999999,
      name: 'Test Food',
      brand: 'Test Brand',
      serving_size: 100,
      serving_unit: 'g',
      calories_per_serving: 100,
      protein_g: 10,
      carbs_g: 20,
      fat_g: 5,
      fiber_g: 3,
      sugar_g: 5,
      sodium_mg: 100,
      cholesterol_mg: 0,
      vitamin_a_mcg: 50,
      vitamin_c_mg: 10,
      calcium_mg: 100,
      iron_mg: 2,
      potassium_mg: 200,
      magnesium_mg: 25,
      zinc_mg: 1,
      selenium_mcg: 10,
      vitamin_d_mcg: 5,
      vitamin_b12_mcg: 2,
      folate_mcg: 50,
      vitamin_e_mg: 1,
      is_verified: true,
    }

    console.log('🧪 Testing insert with all required columns...')
    const { data: insertResult, error: insertError } = await supabase
      .from('foods')
      .insert(testFood)
      .select()

    if (insertError) {
      console.error('❌ Schema test failed:', insertError)
      console.log('\n🔍 This usually means missing columns. Required columns:')
      requiredColumns.forEach(col => console.log(`   • ${col}`))
      return
    }

    console.log('✅ Schema test passed - all required columns exist!')

    // Clean up test record
    if (insertResult && insertResult.length > 0) {
      await supabase.from('foods').delete().eq('id', insertResult[0].id)
      console.log('🧹 Cleaned up test record')
    }

    // 4. Final verification
    const { count: finalCount } = await supabase
      .from('foods')
      .select('*', { count: 'exact', head: true })

    console.log('\n🎉 DATABASE READY FOR IMPORT!')
    console.log('='.repeat(40))
    console.log(`✅ Foods table exists with all required columns`)
    console.log(`✅ Database is clean (${finalCount || 0} records)`)
    console.log(`✅ Ready for USDA bulk import`)
    console.log(`\nNext step: Run the rate-limited import script`)
    console.log(`Command: npx tsx scripts/rate-limited-import.ts`)
  } catch (error) {
    console.error('❌ Cleanup failed:', error)
  }
}

// Run cleanup
cleanupAndVerify().catch(console.error)
