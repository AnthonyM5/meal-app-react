import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// Test script to verify USDA API connection
async function testUSDAConnection() {
  const USDA_API_KEY = process.env.NEXT_PUBLIC_USDA_API_KEY
  const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1'

  console.log('🔍 Testing USDA API Connection...')
  console.log(
    `API Key: ${
      USDA_API_KEY ? `${USDA_API_KEY.substring(0, 8)}...` : 'NOT FOUND'
    }`
  )

  if (!USDA_API_KEY || USDA_API_KEY === 'DEMO_KEY') {
    console.error('❌ USDA_API_KEY not found in environment variables')
    console.log('Please add USDA_API_KEY=your_key_here to your .env.local file')
    return
  }

  try {
    // Test a simple search
    const testQuery = 'banana'
    const url = `${USDA_BASE_URL}/foods/search?api_key=${USDA_API_KEY}&query=${testQuery}&pageSize=5`

    console.log(`🌐 Testing search for "${testQuery}"...`)

    const response = await fetch(url)
    const data = await response.json()

    if (response.ok) {
      console.log('✅ USDA API connection successful!')
      console.log(`📊 Found ${data.totalHits} total results for "${testQuery}"`)
      console.log('📝 Sample results:')

      data.foods?.slice(0, 3).forEach((food: any, index: number) => {
        console.log(`  ${index + 1}. ${food.description} (ID: ${food.fdcId})`)
      })
    } else {
      console.error('❌ USDA API Error:', data)
    }
  } catch (error) {
    console.error('❌ Connection Error:', error)
  }
}

testUSDAConnection()
