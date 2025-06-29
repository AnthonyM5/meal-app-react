'use client'

import { useCallback, useState } from 'react'

export function useGuestMode() {
  const [isGuest, setIsGuest] = useState(() => {
    // Initialize from sessionStorage if available (client-side)
    if (typeof window !== 'undefined') {
      const guestModeCookie = document.cookie
        .split(';')
        .some(item => item.trim().startsWith('guestMode=true'))
      const guestModeStorage = sessionStorage.getItem('guestMode') === 'true'
      return guestModeCookie || guestModeStorage
    }
    return false
  })

  const exitGuestMode = useCallback(() => {
    // Clear both cookie and sessionStorage
    document.cookie =
      'guestMode=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    sessionStorage.removeItem('guestMode')
    setIsGuest(false)
    window.location.href = '/auth/login'
  }, [])

  return {
    isGuest,
    exitGuestMode,
  }
}
