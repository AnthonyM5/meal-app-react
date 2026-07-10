import { Metadata, Viewport } from 'next'
import DogsPage from './dogs-page'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'My Dogs - PawPlate',
  description: 'Manage your dogs and their feeding profiles',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2E7D32',
}

export default function Page() {
  return <DogsPage />
}
