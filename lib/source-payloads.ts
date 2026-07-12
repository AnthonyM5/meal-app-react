import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, SourcePayload } from '@/lib/types'

/**
 * Persist a raw API response into `source_payloads` (see migration
 * 20260711000000). Detail payloads are keyed by the source's own id
 * (fdc_id / OFF barcode); search payloads are keyed by the query string,
 * preserving candidates that import filters excluded so later passes can
 * widen coverage from stored data instead of re-running the API.
 *
 * Upserts on (source, kind, external_id) — a re-fetch refreshes the stored
 * payload and fetched_at. Failures are logged, never thrown: payload
 * archival must not break an import.
 */
export async function storePayload(
  supabase: SupabaseClient<Database>,
  entry: {
    source: 'usda' | 'off'
    kind: 'detail' | 'search'
    externalId: string | number
    payload: unknown
    foodId?: string | null
  }
): Promise<void> {
  const { error } = await supabase.from('source_payloads').upsert(
    {
      source: entry.source,
      kind: entry.kind,
      external_id: String(entry.externalId),
      payload: entry.payload as SourcePayload['payload'],
      food_id: entry.foodId ?? null,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: 'source,kind,external_id' }
  )
  if (error) {
    console.error(
      `storePayload failed (${entry.source}/${entry.kind}/${entry.externalId}):`,
      error.message
    )
  }
}
