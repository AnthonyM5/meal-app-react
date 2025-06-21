const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

const USDA_API_KEY = process.env.NEXT_PUBLIC_USDA_API_KEY
const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1'

async function testEndpoints() {
  try {
    // Test foods/list endpoint
    console.log('=== Testing /foods/list endpoint ===')
    const listResponse = await fetch(
      USDA_BASE_URL + '/foods/list?pageSize=2&pageNumber=1&dataType=Foundation',
      {
        headers: { 'X-Api-Key': USDA_API_KEY },
      }
    )
    const listData = await listResponse.json()
    console.log('List response sample (first item):')
    console.log(JSON.stringify(listData[0], null, 2))

    console.log('\n=== Testing /foods batch endpoint ===')
    const fdcId = listData[0].fdcId
    const batchResponse = await fetch(USDA_BASE_URL + '/foods', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': USDA_API_KEY,
      },
      body: JSON.stringify({
        fdcIds: [fdcId],
        format: 'full',
      }),
    })
    const batchData = await batchResponse.json()
    console.log('Batch response sample (first item):')
    console.log(JSON.stringify(batchData[0], null, 2))

    console.log('\n=== Data Comparison ===')
    console.log(
      'List endpoint nutrient count:',
      listData[0].foodNutrients?.length || 0
    )
    console.log(
      'Batch endpoint nutrient count:',
      batchData[0].foodNutrients?.length || 0
    )

    console.log('\n=== Key Differences ===')
    console.log('List endpoint keys:', Object.keys(listData[0]))
    console.log('Batch endpoint keys:', Object.keys(batchData[0]))
  } catch (error) {
    console.error('Error:', error)
  }
}

testEndpoints()
