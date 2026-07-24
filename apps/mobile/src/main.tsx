import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/fraunces/600.css'
import '@fontsource/fraunces/700.css'
import './globals.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { Toaster } from 'sonner'
import { App } from './App'
import { initSocialAuth } from './lib/socialAuth'

// Fire-and-forget: configure native Google sign-in. No-op when unconfigured.
void initSocialAuth()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Toaster position="top-center" richColors />
    </BrowserRouter>
  </StrictMode>
)
