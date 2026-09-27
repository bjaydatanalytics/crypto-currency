import { cn } from '@/lib/utils'
import type { InvestmentStatus, TransactionStatus, VerificationStatus } from '@/lib/types'

type Tone = 'neutral' | 'accent' | 'success' | 'warn' | 'danger' | 'info'

const tones: Record<Tone, string> = {
  neutral: 'bg-white/[0.06] text-muted border-line',
  accent: 'bg-accent/12 text-accent border-accent/25',
  success: 'bg-positive/12 text-positive border-positive/25',
  warn: 'bg-warn/12 text-warn border-warn/25',
  danger: 'bg-negative/12 text-negative border-negative/25',
  info: 'bg-sky-400/12 text-sky-300 border-sky-400/25',
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  /** Shows a small leading dot — useful for live/status indicators. */
  dot?: boolean
}

export function Badge({ tone = 'neutral', dot, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider',
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  )
}

const statusTone: Record<TransactionStatus | InvestmentStatus | VerificationStatus, Tone> = {
  completed: 'success',
  pending: 'warn',
  failed: 'danger',
  active: 'accent',
  cancelled: 'neutral',
  verified: 'success',
  unverified: 'neutral',
  rejected: 'danger',
}

export function StatusBadge({
  status,
  className,
}: {
  status: TransactionStatus | InvestmentStatus | VerificationStatus
  className?: string
}) {
  return (
    <Badge tone={statusTone[status]} dot className={className}>
      {status}
    </Badge>
  )
}

/** Persistent marker for simulated data. Used wherever sample figures appear. */
export function DemoBadge({ className, label = 'Demo data' }: { className?: string; label?: string }) {
  return (
    <Badge tone="warn" className={cn('normal-case tracking-normal', className)}>
      {label}
    </Badge>
  )
}
