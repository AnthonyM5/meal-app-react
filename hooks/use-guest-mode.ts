'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export function useGuestMode() {
  const [isGuest, setIsGuest] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check session storage for guest mode on mount
    const guestMode = sessionStorage.getItem('guestMode') === 'true'
    setIsGuest(guestMode)
  }, [])

  const exitGuestMode = () => {
    sessionStorage.removeItem('guestMode')
    setIsGuest(false)
    router.push('/auth/login')
  }

  return {
    isGuest,
    exitGuestMode,
  }
}
