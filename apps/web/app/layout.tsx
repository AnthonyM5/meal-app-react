import { AppHeader } from '@/components/app-header'
import { Toaster } from '@/components/ui/sonner'
import type { Metadata, Viewport } from 'next'
import { Fraunces, Inter } from 'next/font/google'
import type React from 'react'
import './globals.css'

// Inter for body/UI, Fraunces (soft serif) for display/headings — the
// PawPlate brand type pairing. Exposed as CSS variables consumed by Tailwind.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '900'],
  variable: '--font-fraunces',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Brand green — colors the mobile browser chrome / PWA status bar.
  themeColor: '#2E7D32',
}

// Absolute base for OG/Twitter image URLs. Set NEXT_PUBLIC_SITE_URL in prod
// (e.g. https://pawplate.app); localhost is only a dev fallback.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

const TITLE = 'PawPlate — Fresh-Feeding Dog Nutrition'
const DESCRIPTION =
  'Real food, real results. Balanced home-cooked meals and nutrient tracking for your dog, against NRC/AAFCO targets.'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: 'PawPlate',
  // Favicon + apple-touch icon come from app/icon.svg and app/apple-icon.png
  // (App Router file conventions) — no manual `icons` block needed.
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PawPlate',
  },
  openGraph: {
    type: 'website',
    siteName: 'PawPlate',
    title: TITLE,
    description: DESCRIPTION,
    url: siteUrl,
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'PawPlate — Real food. Real results.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="PawPlate" />
      </head>
      <body className={inter.className}>
        <AppHeader />
        {children}
        <footer className="border-t px-4 py-4">
          <p className="mx-auto max-w-3xl text-center text-xs text-muted-foreground">
            PawPlate provides general dog-nutrition information for
            educational purposes only. It is not veterinary advice, diagnosis,
            or treatment — always consult your veterinarian before changing
            your dog&apos;s diet.
          </p>
        </footer>
        <Toaster />
      </body>
    </html>
  )
}
