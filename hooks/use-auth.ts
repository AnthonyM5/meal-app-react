'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'

export const useAuth = () => {
  const supabase = createClientComponentClient()
  const router = useRouter()

  const signInAsGuest = async () => {
    // Store guest mode in session storage (cleared when browser closes)
    sessionStorage.setItem('guestMode', 'true')
    router.push('/dashboard')
  }

  const signOut = async () => {
    sessionStorage.removeItem('guestMode')
    await supabase.auth.signOut()
    router.push('/')
  }

  // Check if user is in guest mode
  const isGuest = () => {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem('guestMode') === 'true'
  }

  return { signInAsGuest, signOut, isGuest }
}
