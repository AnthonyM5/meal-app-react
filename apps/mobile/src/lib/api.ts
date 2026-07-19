import { Capacitor } from '@capacitor/core'
import { createPawPlateClient } from '@pawplate/api-client'
import { supabase } from './supabase'

const configuredBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

// One dist/ is synced into both native shells, but the Android emulator
// reaches the host machine as 10.0.2.2, not localhost — rewrite at runtime
// so a localhost dev build works in both simulators. Deployed (https) base
// URLs contain no "localhost" and pass through untouched.
const baseUrl =
  Capacitor.getPlatform() === 'android'
    ? configuredBaseUrl.replace('//localhost', '//10.0.2.2')
    : configuredBaseUrl

export const api = createPawPlateClient({
  baseUrl,
  getAccessToken: async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  },
})

export { ApiError } from '@pawplate/api-client'
