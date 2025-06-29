'use client'

import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function GuestModeButton() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleGuestMode = async () => {
    try {
      setIsLoading(true)

      // Set cookie with all necessary attributes
      const date = new Date()
      date.setTime(date.getTime() + 24 * 60 * 60 * 1000) // 24 hours
      const expires = date.toUTCString()
      document.cookie = `guestMode=true; path=/; expires=${expires}; SameSite=Lax`

      // Set in session storage for client-side checks
      sessionStorage.setItem('guestMode', 'true')

      router.push('/dashboard')
    } catch (error) {
      console.error('Error enabling guest mode:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      className="w-full"
      onClick={handleGuestMode}
      disabled={isLoading}
    >
      {isLoading ? 'Loading...' : 'Continue as Guest'}
    </Button>
  )
}
