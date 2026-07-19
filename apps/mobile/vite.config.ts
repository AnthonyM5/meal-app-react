import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Expose on the LAN so a phone (or the Capacitor live-reload shell) can
    // reach the dev server; the REST backend is apps/web on :3000.
    host: true,
  },
})
