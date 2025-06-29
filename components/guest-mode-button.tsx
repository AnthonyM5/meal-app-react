'use client'

import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export function GuestModeButton() {
  const router = useRouter()

  const handleGuestMode = () => {
    // Set guest mode cookie (expires in 24 hours)
    document.cookie = 'guestMode=true; path=/; max-age=86400'
    // Set in session storage for client-side checks
    sessionStorage.setItem('guestMode', 'true')
    // Redirect to dashboard
    router.push('/dashboard')
  }

  return (
    <Button variant="ghost" className="w-full" onClick={handleGuestMode}>
      Continue as Guest
    </Button>
  )
}
