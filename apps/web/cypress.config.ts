import { createClient } from '@supabase/supabase-js'
import { defineConfig } from 'cypress'
import dotenv from 'dotenv'

// Load the same env files Next.js does, in the same precedence order
// (.env first, then .env.local overrides it) — so `npx cypress run` works
// standalone, with no need to `set -a && source .env.local && set +a` first.
dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local', override: true })

// Admin client for test-user lifecycle.
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for e2e auth tasks'
    )
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'cypress/support/e2e.ts',
    video: false,
    screenshotOnRunFailure: true,
    setupNodeEvents(on, config) {
      on('task', {
        // Create a confirmed throwaway user (remote project has email
        // confirmations on, so signup via the UI can't complete in CI).
        async createTestUser() {
          const admin = adminClient()
          const email = `pawplate.e2e.${Date.now()}@example.com`
          const password = `E2e-${Date.now()}-pw!`
          const { data, error } = await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
          })
          if (error) throw error
          return { email, password, id: data.user.id }
        },
        // Delete the user; cascades clean up profiles, dogs, and meals.
        async deleteTestUser(userId: string) {
          const admin = adminClient()
          const { error } = await admin.auth.admin.deleteUser(userId)
          if (error) throw error
          return null
        },
        // Password sign-in as an anon-key client, for exercising the mobile
        // REST routes (Authorization: Bearer <access_token>, no cookies —
        // that's the whole point of those routes).
        async signInTestUser({
          email,
          password,
        }: {
          email: string
          password: string
        }) {
          const url = process.env.NEXT_PUBLIC_SUPABASE_URL
          const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          if (!url || !anonKey) {
            throw new Error(
              'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set'
            )
          }
          const client = createClient(url, anonKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          })
          const { data, error } = await client.auth.signInWithPassword({
            email,
            password,
          })
          if (error) throw error
          if (!data.session) throw new Error('Sign-in produced no session')
          return { accessToken: data.session.access_token }
        },
        // Insert a dog owned by an arbitrary user. Used to prove that one
        // user cannot analyze/patch a bowl against another user's dog.
        async createDogForUser({
          userId,
          name,
        }: {
          userId: string
          name: string
        }) {
          const admin = adminClient()
          const { data, error } = await admin
            .from('dogs')
            .insert({ owner_id: userId, name, weight_kg: 12 })
            .select('id')
            .single()
          if (error) throw error
          return data.id
        },
        // Cleanup for tests that create a foods row via /api/ingredients/*.
        // Since migration 20260714010000, foods.created_by is ON DELETE SET
        // NULL, so deleteTestUser no longer *needs* this — but without it
        // every run would leave an orphaned custom-ingredient row in the
        // live table, so delete explicitly anyway.
        async deleteFood(foodId: string) {
          const admin = adminClient()
          const { error } = await admin.from('foods').delete().eq('id', foodId)
          if (error) throw error
          return null
        },
        // Read back the most recent meal for a dog so tests can assert the
        // persisted `source` (e.g. 'photo') rather than just the UI text.
        async getLatestMealForDog(dogId: string) {
          const admin = adminClient()
          const { data, error } = await admin
            .from('meals')
            .select('id, source, meal_type, date')
            .eq('dog_id', dogId)
            .order('created_at', { ascending: false })
            .limit(1)
          if (error) throw error
          return data?.[0] ?? null
        },
      })
      return config
    },
  },
  defaultCommandTimeout: 10000,
  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack',
    },
  },
})
