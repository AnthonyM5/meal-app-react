import type { Database } from '@pawplate/core'
import { createClient } from '@supabase/supabase-js'

// Native shell holds its own session (localStorage inside the WebView) — no
// @supabase/ssr cookies here, per the mobile-strategy auth notes in
// docs/PAWPLATE_PROGRESS.md. The access token is forwarded per-request to the
// REST layer by lib/api.ts.
export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
)
