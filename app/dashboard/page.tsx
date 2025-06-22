import DashboardPage from './dashboard-page'
import { checkAuthStatus } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard - Meal Tracker',
  description: 'View and manage your meals'
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000'
}

export default async function Page() {
  const { isAuthenticated } = await checkAuthStatus()
  
  if (!isAuthenticated) {
    redirect('/auth/login')
  }

  return <DashboardPage />
}
