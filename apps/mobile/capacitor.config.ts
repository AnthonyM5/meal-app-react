import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.pawplate.app',
  appName: 'PawPlate',
  webDir: 'dist',
  // Dev convenience: the Android shell runs from https://localhost, so
  // calling the plain-http dev API (http://10.0.2.2:3000) is both cleartext
  // and mixed content — these two flags permit it. Drop both (and build with
  // an https VITE_API_BASE_URL) for store builds.
  server: {
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
}

export default config
