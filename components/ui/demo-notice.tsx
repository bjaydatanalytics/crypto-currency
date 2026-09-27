import { AlertTriangle, FlaskConical } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Disclosure components.
 *
 * These exist so that no screen showing simulated figures can be mistaken for
 * a record of real activity. Keep them visible — do not hide them behind a
 * dismiss control, and do not soften the wording.
 */

export function DemoNotice({
  className,
  title = 'Demo environment',
  children,
}: {
  className?: string
  title?: string
  children?: React.ReactNode
}) {
  return (
    <div
      role="note"
      className={cn(
        'flex items-start gap-3 rounded-xl border border-warn/25 bg-warn/[0.07] p-4',
        className,
      )}
    >
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
      <div className="min-w-0 text-sm">
        <p className="font-medium text-warn">{title}</p>
        <p className="mt-1 leading-relaxed text-white/70">
          {children ??
            'Figures on this screen are sample data for demonstration only. No real funds, orders or transactions are involved.'}
        </p>
      </div>
    </div>
  )
}

/** Compact inline variant for card headers and section subtitles. */
export function DemoInline({ className, text }: { className?: string; text?: string }) {
  return (
    <p className={cn('flex items-center gap-1.5 text-xs text-muted', className)}>
      <FlaskConical className="h-3 w-3 shrink-0 text-warn" aria-hidden="true" />
      {text ?? 'Sample data for demonstration'}
    </p>
  )
}

/** Risk disclosure block used on marketing and plan pages. */
export function RiskNotice({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div
      role="note"
      className={cn('rounded-xl border border-line bg-surface p-5', className)}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
        <div className="min-w-0 text-sm leading-relaxed text-muted">
          <p className="mb-1 font-medium text-white">Risk warning</p>
          {children ?? (
            <p>
              Digital assets are highly volatile and largely unregulated. The value of your
              holdings can fall as well as rise and you may get back less than you put in. Past
              performance does not predict future results. Nothing on this site is investment
              advice or a guarantee of return. Only commit money you can afford to lose.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Marker for information the client must supply and verify before launch.
 * Renders visibly rather than silently omitting, so nothing ships half-filled.
 */
export function PendingInfo({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-dashed border-line bg-white/[0.02] px-2 py-1 text-xs text-muted',
        className,
      )}
    >
      {label} — to be supplied
    </span>
  )
}
