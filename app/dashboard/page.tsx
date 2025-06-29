import { Metadata, Viewport } from 'next'
import DashboardPage from './dashboard-page'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Dashboard - Meal Tracker',
  description: 'View and manage your meals',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
}

// No server-side auth check, let client handle everything
export default function Page() {
  return <DashboardPage />
}
