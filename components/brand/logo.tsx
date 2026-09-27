import Link from 'next/link'
import { brand } from '@/lib/config'
import { cn } from '@/lib/utils'

/**
 * Original abstract mark for the placeholder brand.
 *
 * Two nested chevrons rising to the right, enclosed in a rounded square: a
 * neutral "growth" glyph drawn from scratch. Replace the paths (and `brand`
 * in lib/config.ts) when the real identity is supplied.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn('h-8 w-8', className)}
    >
      <rect
        x="0.75"
        y="0.75"
        width="30.5"
        height="30.5"
        rx="9"
        stroke="currentColor"
        strokeOpacity="0.28"
        strokeWidth="1.5"
      />
      <path
        d="M8 20.5L13.5 12.5L17.5 17.5L24 9"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="9" r="2.4" fill="currentColor" />
    </svg>
  )
}

interface LogoProps {
  className?: string
  /** Hide the wordmark and show the glyph only (collapsed sidebars). */
  markOnly?: boolean
  href?: string
}

export function Logo({ className, markOnly, href = '/' }: LogoProps) {
  return (
    <Link
      href={href}
      aria-label={`${brand.name} home`}
      className={cn(
        'group inline-flex items-center gap-2.5 transition-opacity hover:opacity-90',
        className,
      )}
    >
      <LogoMark className="h-8 w-8 shrink-0 text-accent" />
      {!markOnly && (
        <span className="text-[17px] font-bold tracking-[0.18em] text-white">
          {brand.wordmark}
        </span>
      )}
    </Link>
  )
}
