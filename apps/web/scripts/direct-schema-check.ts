#!/usr/bin/env node

/**
 * Direct Database Schema Check
 *
 * This script directly queries the database to check what columns actually exist.
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkSchemaDirectly() {
  console.log('🔍 Checking database schema directly...\n')

  try {
    // Query the information_schema to see what columns actually exist
    const { data, error } = await supabase.rpc('check_foods_table_columns')

    if (error) {
      console.log(
        '⚠️  RPC function not available, using alternative approach...'
      )

      // Try to select from foods table to see what columns are available
      const { data: tableData, error: tableError } = await supabase
        .from('foods')
        .select('*')
        .limit(0) // Get no rows, just schema info

      if (tableError) {
        console.error('❌ Error checking table:', tableError)
        return
      }

      console.log('✅ Foods table is accessible')

      // Try inserting without fdc_id to see what happens
      console.log('\n🧪 Testing insert without fdc_id...')
      const testData = {
        name: 'Test Food',
        brand: 'Test',
        serving_size: 100,
        serving_unit: 'g',
        calories_per_serving: 100,
        protein_g: 10,
        carbs_g: 20,
        fat_g: 5,
        fiber_g: 3,
        is_verified: true,
      }

      const { data: insertData, error: insertError } = await supabase
        .from('foods')
        .insert(testData)
        .select()

      if (insertError) {
        console.log('❌ Insert failed:', insertError.message)
      } else {
        console.log('✅ Insert succeeded without fdc_id')
        // Clean up
        if (insertData && insertData.length > 0) {
          await supabase.from('foods').delete().eq('id', insertData[0].id)
        }
      }

      // Now try with fdc_id
      console.log('\n🧪 Testing insert with fdc_id...')
      const testDataWithFdc = {
        ...testData,
        fdc_id: 999999,
      }

      const { data: insertData2, error: insertError2 } = await supabase
        .from('foods')
        .insert(testDataWithFdc)
        .select()

      if (insertError2) {
        console.log('❌ Insert with fdc_id failed:', insertError2.message)
        console.log(
          '\n🚨 CONCLUSION: fdc_id column does NOT exist in remote database'
        )
        console.log(
          '\n💡 SOLUTION: We need to apply the migration manually or use an alternative approach'
        )
        console.log('\nOptions:')
        console.log(
          '1. Create foods without fdc_id and use id for deduplication'
        )
        console.log('2. Manually add the column via SQL')
        console.log('3. Reset the entire database and re-run migrations')
      } else {
        console.log('✅ Insert with fdc_id succeeded!')
        console.log('🎉 fdc_id column exists and is working')
        // Clean up
        if (insertData2 && insertData2.length > 0) {
          await supabase.from('foods').delete().eq('id', insertData2[0].id)
        }
      }
    } else {
      console.log('Schema data:', data)
    }
  } catch (error) {
    console.error('❌ Schema check failed:', error)
  }
}

// Run the check
checkSchemaDirectly().catch(console.error)
