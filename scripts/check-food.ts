import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

async function checkFood() {
  const { data, error } = await supabase
    .from('foods')
    .select('*')
    .eq('fdc_id', 171998)
    .single()

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('Food details:')
  console.log(JSON.stringify(data, null, 2))
}

checkFood().catch(console.error)
