'use client'

import { supabase } from '@/lib/supabase/client'
import { createPawPlateClient } from '@pawplate/api-client'

/**
 * The shared REST client, for web client components.
 *
 * The /api/ingredients/* REST routes authenticate with a Bearer token ONLY
 * (lib/server/rest-auth.ts) — a raw same-origin fetch sends session cookies,
 * which those routes ignore, so it 401s for a logged-in owner. Every call to
 * the REST surface from web client code must go through this client, which
 * attaches the browser session's access token exactly like the mobile shell
 * does (apps/mobile/src/lib/api.ts).
 *
 * baseUrl is empty: requests stay same-origin relative ('/api/...').
 */
export const apiClient = createPawPlateClient({
  baseUrl: '',
  getAccessToken: async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  },
})

export { ApiError } from '@pawplate/api-client'
