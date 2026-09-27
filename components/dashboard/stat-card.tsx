import { Card } from '@/components/ui/card'
import { InfoTip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * Headline figure tile.
 *
 * A stat tile is the right form when a single number is the whole message —
 * no plot, no axis, just the value with its label and an optional delta.
 */
export function StatCard({
  label,
  value,
  delta,
  deltaLabel,
  icon,
  info,
  className,
}: {
  label: string
  value: string
  delta?: number
  deltaLabel?: string
  icon?: React.ReactNode
  info?: string
  className?: string
}) {
  const positive = (delta ?? 0) >= 0

  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
          {info && <InfoTip content={info} />}
        </div>
        {icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-white/[0.03] text-accent">
            {icon}
          </span>
        )}
      </div>

      <p className="num mt-3 text-[clamp(1.375rem,3.4vw,1.75rem)] font-semibold leading-none tracking-tight text-white">
        {value}
      </p>

      {delta !== undefined && (
        <p className="mt-2.5 flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              'num rounded-md px-1.5 py-0.5 font-medium',
              positive ? 'bg-positive/10 text-positive' : 'bg-negative/10 text-negative',
            )}
          >
            {positive ? '+' : ''}
            {delta.toFixed(2)}%
          </span>
          {deltaLabel && <span className="text-muted">{deltaLabel}</span>}
        </p>
      )}
    </Card>
  )
}
