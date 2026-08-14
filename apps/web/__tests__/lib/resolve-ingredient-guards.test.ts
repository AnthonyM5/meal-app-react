/**
 * The two eligibility bars on the auto-match path, and the one place that used
 * to bypass them.
 *
 * Both guards exist because an auto-matched row is committed WITHOUT the owner
 * ever confirming it — so a wrong row here is silent. The failure modes differ:
 *
 *   unsafe        -> logging a food the bowl does not contain AND suppressing
 *                    the toxicity banner, which the confirmation UI keys off
 *                    the RESOLVED row (components/bowl-confirmation.tsx).
 *   0 kcal + macros -> understating the meal's energy by 100%.
 */
import { describe, expect, it } from '@jest/globals'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  matchIngredientWithCanonical,
  matchLocalIngredient,
} from '@/lib/resolve-ingredient'
import type { Database } from '@/lib/types'

type Row = {
  id: string
  name: string
  similarity?: number
  is_safe_for_dogs?: boolean
  preparation_state?: string | null
  calories_per_serving?: number | null
  protein_g?: number | null
  fat_g?: number | null
  carbs_g?: number | null
  serving_size?: number | null
}

/** A healthy, loggable row. Spread and override to make a broken one. */
const ok = (over: Partial<Row> & { id: string; name: string }): Row => ({
  similarity: 0.9,
  is_safe_for_dogs: true,
  preparation_state: null,
  calories_per_serving: 100,
  protein_g: 5,
  fat_g: 2,
  carbs_g: 10,
  serving_size: 100,
  ...over,
})

/** Client exposing only fuzzy_search_foods — all matchLocalIngredient needs. */
function searchClient(rows: Row[]): SupabaseClient<Database> {
  return {
    rpc: async () => ({ data: rows, error: null }),
  } as unknown as SupabaseClient<Database>
}

describe('matchLocalIngredient — unsafe rows', () => {
  it('refuses to auto-match when the top hit is toxic', async () => {
    // The case that matters: photograph a bowl with onion in it. Skipping to
    // the next candidate would log "Onion rings" as safe and the owner would
    // never see a warning. Returning null leaves the label visibly unresolved.
    const id = await matchLocalIngredient(
      searchClient([
        ok({ id: 'onion', name: 'Onions, raw', is_safe_for_dogs: false, similarity: 0.95 }),
        ok({ id: 'rings', name: 'Onion rings', similarity: 0.7 }),
      ]),
      'onion'
    )
    expect(id).toBeNull()
  })

  it('still matches when something safe outranks the toxic row', async () => {
    // A lower-scoring toxic row was never going to win, so it must not
    // poison an otherwise good match. "beef" should not be blocked by
    // "Beef with onions" sitting further down the list.
    const id = await matchLocalIngredient(
      searchClient([
        ok({ id: 'beef', name: 'Beef, ground, cooked', similarity: 0.93 }),
        ok({ id: 'onions', name: 'Beef with onions', is_safe_for_dogs: false, similarity: 0.6 }),
      ]),
      'beef'
    )
    expect(id).toBe('beef')
  })
})

describe('matchLocalIngredient — nutritionally unusable rows', () => {
  it('skips a 0 kcal row that still reports macros', async () => {
    // Physically impossible: 21 g protein cannot be 0 kcal. 245 such rows were
    // live before scripts/029. Degrade to a worse NAME match, never a
    // silently wrong NUMBER.
    const id = await matchLocalIngredient(
      searchClient([
        ok({ id: 'broken', name: 'Chickpeas, mature seeds', calories_per_serving: 0, protein_g: 21, similarity: 0.95 }),
        ok({ id: 'good', name: 'Chickpeas, mature seeds, cooked', calories_per_serving: 164, similarity: 0.8 }),
      ]),
      'chickpeas'
    )
    expect(id).toBe('good')
  })

  it('accepts a row that is zero on energy AND every macro', async () => {
    // Deliberate limit: only the PROVABLY impossible is rejected. Eggshell
    // powder really is 0/0/0/0, and 18 "empty shells" share that shape (see
    // audits/zero-calorie-backfill.md). Rejecting them would be a guess.
    const id = await matchLocalIngredient(
      searchClient([
        ok({ id: 'shell', name: 'Eggshell powder', calories_per_serving: 0, protein_g: 0, fat_g: 0, carbs_g: 0 }),
      ]),
      'eggshell powder'
    )
    expect(id).toBe('shell')
  })
})

/**
 * Client for matchIngredientWithCanonical. Serves, in order:
 *   rpc fuzzy_search_foods                  -> `hits`
 *   foods.select(canonical_id,...).single() -> `matched`
 *   canonical_ingredients...single()        -> a stub group
 *   foods.select(...).eq().eq()             -> `variants`  (awaited, no .single)
 */
function groupClient({
  hits,
  matched,
  variants,
}: {
  hits: Row[]
  matched: { canonical_id: string; preparation_state: string | null }
  variants: Row[]
}): SupabaseClient<Database> {
  const thenable = (data: unknown) => {
    const settled = Promise.resolve({ data, error: null })
    const chain: Record<string, unknown> = {
      eq: () => chain,
      then: settled.then.bind(settled),
    }
    return chain
  }

  return {
    rpc: async () => ({ data: hits, error: null }),
    from: (table: string) => {
      if (table === 'canonical_ingredients') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { id: 'grp', display_name: 'Chickpea' },
                error: null,
              }),
            }),
          }),
        }
      }
      return {
        select: (columns: string) =>
          columns.startsWith('canonical_id')
            ? {
                eq: () => ({
                  single: async () => ({ data: matched, error: null }),
                }),
              }
            : thenable(variants),
      }
    },
  } as unknown as SupabaseClient<Database>
}

describe('matchIngredientWithCanonical — the prep-correction swap', () => {
  // When preparation is OBSERVED but the matched row disagrees, the resolver
  // swaps in a same-prep sibling from the canonical group. That swap is the
  // one path into a committed match that does not go through
  // matchLocalIngredient, so it has to re-apply the same two bars itself.
  const matchedRaw = { canonical_id: 'grp', preparation_state: 'raw' }
  const hits = [ok({ id: 'raw', name: 'Chickpeas, mature seeds, raw', preparation_state: 'raw' })]

  it('swaps to the cooked sibling when the group offers a sound one', async () => {
    const { ingredientId } = await matchIngredientWithCanonical(
      groupClient({
        hits,
        matched: matchedRaw,
        variants: [
          ok({ id: 'raw', name: 'Chickpeas, mature seeds, raw', preparation_state: 'raw' }),
          ok({ id: 'cooked', name: 'Chickpeas, mature seeds, cooked, boiled', preparation_state: 'cooked', calories_per_serving: 164 }),
        ],
      }),
      'chickpeas',
      'cooked'
    )
    expect(ingredientId).toBe('cooked')
  })

  it('does NOT swap in a toxic sibling', async () => {
    // Group membership asserts "same food", not "fit to log". Correcting
    // raw->cooked is not worth committing a row the matcher would refuse.
    const { ingredientId } = await matchIngredientWithCanonical(
      groupClient({
        hits,
        matched: matchedRaw,
        variants: [
          ok({ id: 'raw', name: 'Onions, raw', preparation_state: 'raw' }),
          ok({ id: 'toxic', name: 'Onions, cooked', preparation_state: 'cooked', is_safe_for_dogs: false }),
        ],
      }),
      'onions',
      'cooked'
    )
    expect(ingredientId).toBe('raw')
  })

  it('does NOT swap in a 0 kcal sibling that reports macros', async () => {
    const { ingredientId } = await matchIngredientWithCanonical(
      groupClient({
        hits,
        matched: matchedRaw,
        variants: [
          ok({ id: 'raw', name: 'Chickpeas, mature seeds, raw', preparation_state: 'raw' }),
          ok({ id: 'broken', name: 'Chickpeas, mature seeds, cooked', preparation_state: 'cooked', calories_per_serving: 0, protein_g: 9 }),
        ],
      }),
      'chickpeas',
      'cooked'
    )
    expect(ingredientId).toBe('raw')
  })
})

describe('matchIngredientWithCanonical — observedPreparation on the contract', () => {
  // The picker filters on this. If it is wrong, the copy ("N options span
  // X-Y kcal") describes a different set than the list on screen.
  const variants = [
    ok({ id: 'raw', name: 'Carrots, raw', preparation_state: 'raw', calories_per_serving: 41 }),
    ok({ id: 'c1', name: 'Carrots, cooked, boiled, drained', preparation_state: 'cooked', calories_per_serving: 35 }),
    ok({ id: 'c2', name: 'Carrots, cooked, boiled, drained, with salt', preparation_state: 'cooked', calories_per_serving: 36 }),
  ]

  it('reports the observed state, and counts only variants in it', async () => {
    const { canonical } = await matchIngredientWithCanonical(
      groupClient({
        hits: [ok({ id: 'c1', name: 'Carrots, cooked, boiled, drained', preparation_state: 'cooked' })],
        matched: { canonical_id: 'grp', preparation_state: 'cooked' },
        variants,
      }),
      'carrots',
      'cooked'
    )
    expect(canonical?.observedPreparation).toBe('cooked')
    // Two cooked variants, not all three.
    expect(canonical?.variantCount).toBe(2)
    expect(canonical?.prepUnresolved).toBe(false)
  })

  it('is null when preparation was never observed, and counts everything', async () => {
    const { canonical } = await matchIngredientWithCanonical(
      groupClient({
        hits: [ok({ id: 'raw', name: 'Carrots, raw', preparation_state: 'raw' })],
        matched: { canonical_id: 'grp', preparation_state: 'raw' },
        variants,
      }),
      'carrots'
    )
    expect(canonical?.observedPreparation).toBeNull()
    expect(canonical?.variantCount).toBe(3)
    // Unobserved prep + a group offering both states => the owner is asked.
    expect(canonical?.prepUnresolved).toBe(true)
    expect(canonical?.requiresChoice).toBe(true)
  })
})
