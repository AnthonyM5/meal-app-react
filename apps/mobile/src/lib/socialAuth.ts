import { SocialLogin } from '@capgo/capacitor-social-login'
import { supabase } from './supabase'

// Google client IDs from the Google Cloud console. The web/server client ID is
// the audience Supabase validates against, so it must ALSO be added to the
// Google provider's "Authorized Client IDs" in the Supabase dashboard (see
// docs / the SSO setup notes) — otherwise signInWithIdToken rejects the token.
const webClientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as
  | string
  | undefined
const iOSClientId = import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID as
  | string
  | undefined

let initialized = false

/** Configure the native Google sign-in plugin once at app startup. */
export async function initSocialAuth(): Promise<void> {
  if (initialized || !webClientId) return
  await SocialLogin.initialize({
    google: { webClientId, iOSClientId },
  })
  initialized = true
}

/**
 * Native Google sign-in → Supabase session. Opens the OS account picker, then
 * hands the returned idToken to Supabase. On success the AuthProvider's
 * onAuthStateChange picks up the new session automatically.
 *
 * @returns error message on failure, or null on success.
 */
export async function signInWithGoogle(): Promise<string | null> {
  if (!webClientId) {
    return 'Google sign-in is not configured.'
  }
  try {
    await initSocialAuth()
    // No `scopes` here: default Google sign-in already returns profile+email in
    // the ID token. Passing custom scopes triggers the plugin's authorization-
    // code flow, which on Android requires extra MainActivity wiring and errors
    // out ("You CANNOT use scopes without modifying the main activity").
    const { result } = await SocialLogin.login({
      provider: 'google',
      options: {},
    })

    const idToken = 'idToken' in result ? result.idToken : null
    if (!idToken) {
      return 'Google did not return an ID token.'
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    })
    if (error) return error.message
    return null
  } catch (err) {
    // The plugin throws (rather than resolving) when the user cancels the
    // picker; surface a readable message and let the caller decide.
    return err instanceof Error ? err.message : 'Google sign-in failed.'
  }
}
