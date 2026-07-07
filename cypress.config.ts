import { createClient } from '@supabase/supabase-js'
import { defineConfig } from 'cypress'

// Admin client for test-user lifecycle. Requires the shell to have
// NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY exported
// (e.g. `set -a && source .env.local && set +a`).
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
      })
      return config
    },
  },
  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack',
    },
  },
})
