import { Metadata, Viewport } from 'next'
import DashboardPage from './dashboard-page'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Dashboard - PawPlate',
  description: "Track your dog's daily nutrition",
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2E7D32',
}

// No server-side auth check, let client handle everything
export default function Page() {
  return <DashboardPage />
}
