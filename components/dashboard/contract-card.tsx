import { CalendarClock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { InvestmentContract, InvestmentState } from '@/lib/api/investments'
import { formatDate } from '@/lib/utils'

/**
 * One of the customer's own contracts.
 *
 * Every amount comes from the contract's frozen terms, never recomputed from
 * the plan it came from — a plan an operator edits tomorrow must not change
 * what this screen says somebody is owed today.
 */

const STATE_TONES: Record<InvestmentState, 'accent' | 'success' | 'neutral'> = {
  active: 'accent',
  matured: 'success',
  cancelled: 'neutral',
}

/** Decimal strings are stored at full scale; trim the padding for display only. */
function trimZeros(value: string): string {
  return value.includes('.') ? value.replace(/\.?0+$/, '') : value
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
      <dd className="num mt-1 text-ink/90">{children}</dd>
    </div>
  )
}

export function ContractCard({ contract }: { contract: InvestmentContract }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-ink">{contract.planName}</h3>
          <p className="num mt-0.5 text-xs text-muted">
            {contract.fixedRatePercent}%{' '}
            {contract.rateBasis === 'annual' ? 'a year' : 'over the term'} ·{' '}
            {contract.durationDays} days
          </p>
        </div>
        <Badge tone={STATE_TONES[contract.status]}>{contract.status}</Badge>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm sm:grid-cols-4">
        <Field label={contract.status === 'active' ? 'Locked' : 'Principal'}>
          {trimZeros(contract.principal)} {contract.assetSymbol}
        </Field>

        <div>
          <dt className="text-xs uppercase tracking-wider text-muted">
            {contract.status === 'matured' ? 'Return paid' : 'Return owed'}
          </dt>
          <dd className="num mt-1 text-accent">
            {contract.status === 'cancelled'
              ? '—'
              : `${trimZeros(contract.expectedReturn)} ${contract.assetSymbol}`}
          </dd>
        </div>

        <Field label="Started">{formatDate(contract.startedAt)}</Field>

        <Field label={contract.status === 'active' ? 'Matures' : 'Ended'}>
          {formatDate(contract.maturedAt ?? contract.cancelledAt ?? contract.maturesAt)}
        </Field>
      </dl>

      {contract.status === 'active' && (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
          {contract.daysRemaining === 0
            ? 'Term complete — awaiting payout'
            : `${contract.daysRemaining} day${contract.daysRemaining === 1 ? '' : 's'} remaining`}
        </p>
      )}

      {contract.status === 'cancelled' && contract.cancellationReason && (
        <p className="mt-4 rounded-lg border border-line bg-elevate/[0.02] p-3 text-xs leading-relaxed text-muted">
          Cancelled: {contract.cancellationReason}. Your principal was returned in full and no
          return was paid.
        </p>
      )}
    </Card>
  )
}
