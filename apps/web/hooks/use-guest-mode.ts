'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

export function useGuestMode() {
  const router = useRouter()
  const [isGuest, setIsGuest] = useState(() => {
    // Initialize from cookie (client-side)
    if (typeof window !== 'undefined') {
      return document.cookie.includes('guestMode=true')
    }
    return false
  })

  // Check for cookie changes only on mount, not periodically
  useEffect(() => {
    const checkCookie = () => {
      if (typeof window !== 'undefined') {
        const hasGuestCookie = document.cookie.includes('guestMode=true')
        setIsGuest(hasGuestCookie)
      }
    }
    
    // Check only once on mount
    checkCookie()
  }, [])

  const exitGuestMode = useCallback(() => {
    // Clear guest mode cookie
    document.cookie = 'guestMode=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    setIsGuest(false)
    // Use Next.js router instead of window.location to avoid crashes
    router.push('/auth/login')
  }, [router])

  return {
    isGuest,
    exitGuestMode,
  }
}
