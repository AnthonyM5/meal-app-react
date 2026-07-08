import { Metadata, Viewport } from 'next'
import BowlPage from './bowl-page'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Log from a photo - PawPlate',
  description: "Photograph your dog's bowl and log the meal",
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
}

export default function Page() {
  return <BowlPage />
}
