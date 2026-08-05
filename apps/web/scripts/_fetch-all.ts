// Fetch every row of a table through PostgREST's 1,000-row page cap.
//
// This loop existed copy-pasted in scripts 024/025/026/027 — and the cap it
// works around has already bitten once: scripts/026 originally fetched
// canonical_ingredients without a range and silently lost every row past
// 1,000. One implementation, imported everywhere, so the next script can't
// reintroduce that bug.

import type { SupabaseClient } from '@supabase/supabase-js'

const PAGE = 1000

export async function fetchAllRows<T>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  opts: { orderBy: string; activeOnly?: boolean }
): Promise<T[]> {
  const rows: T[] = []
  for (let offset = 0; ; offset += PAGE) {
    let query = supabase.from(table).select(select)
    if (opts.activeOnly) query = query.eq('is_active', true)
    const { data, error } = await query
      .order(opts.orderBy)
      .range(offset, offset + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...(data as unknown as T[]))
    if (data.length < PAGE) break
  }
  return rows
}

/** The common case: every active `foods` row, ordered by name. */
export function fetchAllActiveFoods<T>(
  supabase: SupabaseClient,
  select: string
): Promise<T[]> {
  return fetchAllRows<T>(supabase, 'foods', select, {
    orderBy: 'name',
    activeOnly: true,
  })
}
