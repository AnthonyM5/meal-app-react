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
        <circle cx="50" cy="46" r="40" fill="#FBF9F4" />
        {/* Ears */}
        <path d="M22 20 Q4 34 8 56 Q10 68 22 74 Q30 70 29 56 Q28 40 34 26 Z" fill="#C97A2E" />
        <path d="M78 20 Q96 34 92 56 Q90 68 78 74 Q70 70 71 56 Q72 40 66 26 Z" fill="#8A5A2B" />
        {/* Face, with the tan left-side marking */}
        <path d="M50 14 Q72 16 74 42 Q75 60 62 70 Q56 74 50 74 Q44 74 38 70 Q25 60 26 42 Q28 16 50 14 Z" fill="#FEFCF6" />
        <path d="M50 14 Q30 16 27 40 Q26 54 33 64 Q40 70 50 72 L50 14 Z" fill="#D98A3D" />
        {/* Eyes */}
        <ellipse cx="39" cy="42" rx="4.6" ry="5.6" fill="#3A2A1A" />
        <ellipse cx="39" cy="42" rx="2.1" ry="2.6" fill="#8A5A22" />
        <circle cx="37.8" cy="40" r="0.9" fill="#FFFFFF" opacity="0.85" />
        <ellipse cx="63" cy="42" rx="4.6" ry="5.6" fill="#2A1E14" />
        <ellipse cx="63" cy="42" rx="2.1" ry="2.6" fill="#6B4419" />
        <circle cx="61.8" cy="40" r="0.9" fill="#FFFFFF" opacity="0.85" />
        {/* Snout + mouth */}
        <ellipse cx="50" cy="60" rx="7.5" ry="5.6" fill="#241C18" />
        <path d="M50 64 L50 68" stroke="#241C18" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M40 70 Q50 76 60 70" stroke="#241C18" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        {/* Bowl */}
        <path d="M4 78 Q50 96 96 78 L96 100 L4 100 Z" fill="#2E7D32" />
        <path d="M4 78 Q50 96 96 78" stroke="#1B5E20" strokeWidth="1.6" fill="none" />
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
