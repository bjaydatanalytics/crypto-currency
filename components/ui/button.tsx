'use client'

import Link from 'next/link'
import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'success'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-black hover:bg-accent-bright shadow-glow-sm hover:shadow-glow font-semibold',
  secondary: 'bg-white/[0.06] text-white hover:bg-white/[0.12] border border-line',
  ghost: 'text-muted hover:text-white hover:bg-white/[0.06]',
  outline: 'border border-accent/40 text-accent hover:bg-accent/10 hover:border-accent/70',
  danger: 'bg-negative/15 text-negative border border-negative/30 hover:bg-negative/25',
  success: 'bg-positive/15 text-positive border border-positive/30 hover:bg-positive/25',
}

const sizes: Record<Size, string> = {
  // min-h keeps every control at a comfortable touch target on mobile
  sm: 'text-xs px-3.5 min-h-[36px] gap-1.5 rounded-lg',
  md: 'text-sm px-5 min-h-[44px] gap-2 rounded-xl',
  lg: 'text-sm px-7 min-h-[52px] gap-2.5 rounded-xl tracking-wide',
}

interface BaseProps {
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
  className?: string
  children?: React.ReactNode
}

export interface ButtonProps
  extends BaseProps,
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseProps> {}

const base =
  'inline-flex items-center justify-center whitespace-nowrap transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none select-none active:scale-[0.98]'

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, fullWidth, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
})

interface ButtonLinkProps
  extends BaseProps,
    Omit<React.ComponentPropsWithoutRef<typeof Link>, keyof BaseProps> {}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      {...props}
    >
      {children}
    </Link>
  )
}
