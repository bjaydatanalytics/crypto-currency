import Link from 'next/link'
import { ArrowRight, Clock, Frown } from 'lucide-react'
import { formatMoney } from '@/lib/utils'

/**
 * The dark "All Investment" panel at the top of the 401k page.
 *
 * Deliberately inverted against the light panel, the same way the dashboard's
 * 401k banner is: retirement is presented as a distinct product, and the
 * contrast is what separates it from the general investment screens. Text
 * inside is literally white because the fill is always navy.
 */

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[13px] text-white/60">{label}</p>
      <p className="num mt-1 text-xl font-bold tracking-tight text-white">
        ${formatMoney(value)}
      </p>
    </div>
  )
}

export function RetirementSummary({
  totalInvest,
  totalProfit,
  activeCount,
  hasPositions,
}: {
  totalInvest: number
  totalProfit: number
  activeCount: number
  /** False renders the "nothing here" state rather than an empty list. */
  hasPositions: boolean
}) {
  return (
    <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-navy-deep via-navy to-navy-soft p-5 sm:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
        Investment
      </p>
      <h2 className="mt-1 text-xl font-bold tracking-tight text-white">All Investment</h2>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-white/[0.07] p-5">
          <div className="flex items-start justify-between gap-4">
            <Figure label="Total Invest" value={totalInvest} />
            <Figure label="Total Profit" value={totalProfit} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link
              href="#plans"
              className="inline-flex min-h-[36px] items-center rounded-lg bg-accent px-3.5 text-xs font-semibold text-on-accent transition-colors hover:bg-accent-bright"
            >
              Invest Now
            </Link>
            <Link
              href="/dashboard/withdrawals"
              className="inline-flex min-h-[36px] items-center rounded-lg bg-white/10 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-white/20"
            >
              Withdraw Now
            </Link>
          </div>
        </div>

        <div className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-xl bg-white/[0.07] p-5 text-center">
          <Clock className="h-6 w-6 text-white/50" aria-hidden="true" />
          <p className="text-base font-semibold text-white/90">
            {hasPositions
              ? `${activeCount} retirement ${activeCount === 1 ? 'position' : 'positions'} running`
              : 'No Investment Found Yet'}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-bold tracking-tight text-white">
          Active Plan ({activeCount})
        </h3>
        <Link
          href="/dashboard/transactions"
          className="group inline-flex min-h-[32px] items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-on-accent transition-colors hover:bg-accent-bright"
        >
          Investment Logs
          <ArrowRight
            className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>

      {!hasPositions && (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 px-5 py-4">
          <Frown className="h-4 w-4 shrink-0 text-white/50" aria-hidden="true" />
          <p className="text-sm font-medium text-white/70">Data not found</p>
        </div>
      )}
    </section>
  )
}
