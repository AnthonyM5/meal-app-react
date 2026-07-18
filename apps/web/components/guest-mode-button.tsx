'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function GuestModeButton({ className }: { className?: string }) {
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
      className={cn('w-full', className)}
      onClick={handleGuestMode}
      disabled={isLoading}
    >
      {isLoading ? 'Loading...' : 'Continue as Guest'}
    </Button>
  )
}
