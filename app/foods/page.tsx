import { Metadata, Viewport } from 'next'
import FoodsPage from './foods-page'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Browse Foods - PawPlate',
  description: 'Search ingredients by name or by nutrient content',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
}

export default function Page() {
  return <FoodsPage />
}
