import { BrandLogo } from '@/components/brand-logo'
import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Branded backdrop for the anonymous entry points (login / sign-up). The global
 * AppHeader hides on /auth, so this is where those pages pick up the PawPlate
 * lockup. The mark links back to /landing.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-gradient-to-b from-[#E8F5E9] via-[#FAF9F6] to-[#FAF9F6] p-6 dark:from-background dark:via-background dark:to-background">
      <Link
        href="/landing"
        aria-label="PawPlate home"
        className="flex flex-col items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <BrandLogo variant="full" size="lg" />
        <p className="font-display text-sm font-medium text-primary">
          Real food. Real results.
        </p>
      </Link>
      {children}
    </div>
  )
}
