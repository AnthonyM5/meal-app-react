'use client'

import { BrandLogo } from '@/components/brand-logo'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Routes that own the full viewport with their own branding — the header would
// only duplicate the logo there, so it stays out of the way.
const HIDDEN_PREFIXES = ['/landing', '/auth']

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dogs', label: 'Dogs' },
  { href: '/foods', label: 'Foods' },
]

/**
 * Global app chrome: brand lockup + primary nav. Mounted once in the root
 * layout and self-hides on the landing/auth screens via the pathname, so the
 * authenticated surfaces get consistent branding without a per-page header.
 */
export function AppHeader() {
  const pathname = usePathname()

  if (pathname === '/' || HIDDEN_PREFIXES.some(p => pathname.startsWith(p))) {
    return null
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link
          href="/dashboard"
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="PawPlate home"
        >
          <BrandLogo size="sm" />
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {NAV.map(item => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-md px-3 py-1.5 font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
