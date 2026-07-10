'use client'

import { cn } from '@/lib/utils'
import { useId } from 'react'

/**
 * PawPlate brand mark — the dog-face-in-a-bowl icon, inline so it inherits
 * crisp rendering and needs no network request. Same artwork as app/icon.svg
 * and the favicon. `title` is set only when standalone (variant="mark") so the
 * wordmark isn't announced twice to screen readers.
 */
export function BrandMark({
  className,
  title,
}: {
  className?: string
  title?: string
}) {
  // Unique per instance so multiple marks on one page don't share (and clobber)
  // the same clipPath id.
  const clipId = useId()
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <clipPath id={clipId}>
          <circle cx="50" cy="50" r="49" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="49" fill="#2E7D32" />
      <g clipPath={`url(#${clipId})`}>
        <circle cx="50" cy="46" r="40" fill="#FAF6EF" />
        <ellipse cx="22" cy="34" rx="15" ry="20" fill="#1B5E20" transform="rotate(-25 22 34)" />
        <ellipse cx="78" cy="34" rx="15" ry="20" fill="#1B5E20" transform="rotate(25 78 34)" />
        <ellipse cx="34" cy="42" rx="12" ry="16" fill="#D99A55" transform="rotate(-12 34 42)" />
        <ellipse cx="66" cy="42" rx="12" ry="16" fill="#B9843F" transform="rotate(12 66 42)" />
        <circle cx="38" cy="46" r="3.4" fill="#1F2937" />
        <circle cx="62" cy="46" r="3.4" fill="#1F2937" />
        <ellipse cx="50" cy="62" rx="8" ry="6" fill="#1F2937" />
        <path d="M30 68 Q50 82 70 68" stroke="#1F2937" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M0 74 Q50 96 100 74 L100 100 L0 100 Z" fill="#2E7D32" />
        <path d="M0 74 Q50 92 100 74" stroke="#1B5E20" strokeWidth="2" fill="none" />
      </g>
    </svg>
  )
}

const MARK_SIZE = {
  sm: 'h-7 w-7',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
} as const

const WORDMARK_SIZE = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-2xl',
} as const

interface BrandLogoProps {
  /** `full` shows the mark + "PawPlate" wordmark; `mark` is the icon alone. */
  variant?: 'full' | 'mark'
  size?: keyof typeof MARK_SIZE
  className?: string
  /** Tailwind text color for the wordmark; defaults to the theme foreground. */
  wordmarkClassName?: string
}

/**
 * The PawPlate lockup. The wordmark is set in Fraunces (`font-display`) rather
 * than shipped as an image, so it stays crisp at any size and recolors for
 * light/dark or on-brand-green surfaces via `wordmarkClassName`.
 */
export function BrandLogo({
  variant = 'full',
  size = 'md',
  className,
  wordmarkClassName,
}: BrandLogoProps) {
  if (variant === 'mark') {
    return <BrandMark className={cn(MARK_SIZE[size], className)} title="PawPlate" />
  }
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <BrandMark className={MARK_SIZE[size]} />
      <span
        className={cn(
          'font-display font-semibold tracking-tight',
          WORDMARK_SIZE[size],
          wordmarkClassName
        )}
      >
        PawPlate
      </span>
    </span>
  )
}
