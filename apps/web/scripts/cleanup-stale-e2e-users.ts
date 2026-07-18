/**
 * Delete leftover Cypress test users (pawplate.e2e.*@example.com) from the
 * live project. Normally the specs clean up after themselves via the
 * deleteTestUser task; users only accumulate when a run dies before its
 * after() hook (e.g. the 2026-07-14 runs blocked by the foods.created_by
 * FK bug, fixed in migration 20260714010000).
 *
 * Run:
 *   set -a && source .env.local && set +a && npx tsx scripts/cleanup-stale-e2e-users.ts
 *
 * Dry-run by default; pass --delete to actually remove them.
 */
import { createClient } from '@supabase/supabase-js'

const E2E_EMAIL_PREFIX = 'pawplate.e2e.'
const doDelete = process.argv.includes('--delete')

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  const stale: { id: string; email: string }[] = []
  let page = 1
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    stale.push(
      ...data.users
        .filter(u => u.email?.startsWith(E2E_EMAIL_PREFIX))
        .map(u => ({ id: u.id, email: u.email! }))
    )
    if (data.users.length < 200) break
    page++
  }

  console.log(`stale e2e users: ${stale.length}${doDelete ? '' : ' (dry run — pass --delete to remove)'}`)
  for (const u of stale) {
    if (!doDelete) {
      console.log(`  would delete ${u.email}`)
      continue
    }
    // No foods pre-cleanup needed: created_by is ON DELETE SET NULL as of
    // migration 20260714010000, so their manual-ingredient rows survive
    // (orphaned) and user deletion goes through.
    const { error } = await admin.auth.admin.deleteUser(u.id)
    console.log(error ? `  FAILED ${u.email}: ${error.message}` : `  deleted ${u.email}`)
  }
}

main()
