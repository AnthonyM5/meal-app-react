'use client'

import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export const useAuth = () => {
  const router = useRouter()

  const signInAsGuest = async () => {
    // Store guest mode in cookie to work with SSR
    document.cookie = 'guestMode=true; path=/; max-age=86400' // 24 hours
    router.push('/dashboard')
  }

  const signOut = async () => {
    // Clear guest mode cookie
    document.cookie = 'guestMode=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    await supabase.auth.signOut()
    router.push('/')
  }

  // Check if user is in guest mode
  const isGuest = () => {
    if (typeof window === 'undefined') return false
    return document.cookie.includes('guestMode=true')
  }

  return { signInAsGuest, signOut, isGuest }
}
