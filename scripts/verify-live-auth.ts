/**
 * Live auth + RLS smoke test against the hosted Supabase project.
 *
 * Verifies:
 *  1. Admin API can create confirmed users (email confirmations are on remotely).
 *  2. handle_new_user trigger populates profiles.
 *  3. Anon-key sign-in works for those users.
 *  4. RLS: user A can create/read own dog; user B sees none of A's dogs
 *     and cannot update or delete them.
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/verify-live-auth.ts
 *
 * Creates two throwaway users and cleans them (and their dogs) up at the end.
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anonKey || !serviceKey) {
  console.error(
    'Missing env. Run: set -a && source .env.local && set +a  first.'
  )
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let failures = 0
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

function userClient() {
  return createClient(url!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function main() {
  const stamp = Date.now()
  const password = `Pw-${stamp}-smoke!`
  const emailA = `pawplate.smoke.a.${stamp}@example.com`
  const emailB = `pawplate.smoke.b.${stamp}@example.com`
  const createdUserIds: string[] = []

  try {
    // 1. Create two confirmed users via admin API
    const { data: userA, error: errA } = await admin.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    })
    check('admin.createUser A', !errA && !!userA?.user, errA?.message)
    if (userA?.user) createdUserIds.push(userA.user.id)

    const { data: userB, error: errB } = await admin.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    })
    check('admin.createUser B', !errB && !!userB?.user, errB?.message)
    if (userB?.user) createdUserIds.push(userB.user.id)

    if (!userA?.user || !userB?.user) throw new Error('User creation failed')

    // 2. handle_new_user trigger created profiles rows
    const { data: profiles, error: profErr } = await admin
      .from('profiles')
      .select('id')
      .in('id', createdUserIds)
    check(
      'handle_new_user trigger created profiles',
      !profErr && profiles?.length === 2,
      profErr?.message ?? `found ${profiles?.length ?? 0}/2`
    )

    // 3. Sign in with anon key as each user
    const clientA = userClient()
    const { error: signInAErr } = await clientA.auth.signInWithPassword({
      email: emailA,
      password,
    })
    check('anon sign-in as A', !signInAErr, signInAErr?.message)

    const clientB = userClient()
    const { error: signInBErr } = await clientB.auth.signInWithPassword({
      email: emailB,
      password,
    })
    check('anon sign-in as B', !signInBErr, signInBErr?.message)

    // 4. A creates a dog
    const { data: dog, error: dogErr } = await clientA
      .from('dogs')
      .insert({
        owner_id: userA.user.id,
        name: 'Smoke Test Rex',
        weight_kg: 20,
        life_stage: 'adult',
        activity_level: 'moderately_active',
        neutered: true,
      })
      .select()
      .single()
    check('A inserts own dog', !dogErr && !!dog, dogErr?.message)

    // A reads it back
    const { data: aDogs } = await clientA.from('dogs').select('id')
    check('A reads own dog', aDogs?.length === 1, `rows=${aDogs?.length}`)

    // 5. RLS isolation: B sees nothing
    const { data: bDogs, error: bReadErr } = await clientB
      .from('dogs')
      .select('id')
    check(
      'RLS: B cannot see A dogs',
      !bReadErr && bDogs?.length === 0,
      bReadErr?.message ?? `rows=${bDogs?.length}`
    )

    if (dog) {
      // B cannot update A's dog (RLS makes it a 0-row update)
      const { data: bUpd } = await clientB
        .from('dogs')
        .update({ name: 'Hijacked' })
        .eq('id', dog.id)
        .select()
      check('RLS: B update affects 0 rows', (bUpd?.length ?? 0) === 0)

      // B cannot insert a dog owned by A
      const { error: bInsErr } = await clientB.from('dogs').insert({
        owner_id: userA.user.id,
        name: 'Spoofed',
        weight_kg: 10,
      })
      check('RLS: B cannot insert dog owned by A', !!bInsErr, bInsErr?.message)

      // B cannot delete A's dog
      await clientB.from('dogs').delete().eq('id', dog.id)
      const { data: stillThere } = await admin
        .from('dogs')
        .select('id, name')
        .eq('id', dog.id)
      check(
        'RLS: B delete had no effect',
        stillThere?.length === 1 && stillThere[0].name === 'Smoke Test Rex'
      )
    }
  } finally {
    // Cleanup: deleting users cascades to profiles and dogs (FK ON DELETE CASCADE)
    for (const id of createdUserIds) {
      const { error } = await admin.auth.admin.deleteUser(id)
      if (error) console.warn(`cleanup: failed to delete user ${id}: ${error.message}`)
    }
    console.log(`cleanup: removed ${createdUserIds.length} test users`)
  }

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
