import { Button } from '@/components/ui/button'
import type { InvestmentPlan } from '@/lib/types'
import { formatMoney } from '@/lib/utils'

/**
 * One investment plan, as the customer panel presents it.
 *
 * The schema stores a plan as a TOTAL return over a term in days
 * (`fixedRatePercent` / `duration`). The card leads with the per-day figure
 * instead, because that is the number a customer compares plans on — but it
 * never shows the per-day rate alone: "Total N% ROI" sits directly above it
 * and the term directly below, so the headline percentage can't be read as
 * the whole return.
 */

/** A labelled row in the card's terms list. */
function Term({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
      <dt className="shrink-0 text-[13px] text-muted">{label}</dt>
      <dd className="num text-right text-[13px] font-medium text-ink">{children}</dd>
    </div>
  )
}

export interface PlanCardTerms {
  /** Total return over the whole term, as a percentage of principal. */
  totalRatePercent: number
  /** Return per 24-hour period. */
  perPeriodPercent: number
  periods: number
  minimumAmount: number | null
  maximumAmount: number | null
  /** The most this plan can return, at its maximum stake. Null when uncapped. */
  maxEarn: number | null
  currency: string
}

/**
 * Derives the card's figures from a plan.
 *
 * Returns null when the plan promises no rate or has no term — such a plan is
 * not investable and must not be rendered as though it were.
 */
export function planCardTerms(plan: InvestmentPlan): PlanCardTerms | null {
  const total = plan.fixedRatePercent
  const periods = plan.duration

  if (total === null || total === undefined || !periods) return null

  return {
    totalRatePercent: total,
    perPeriodPercent: total / periods,
    periods,
    minimumAmount: plan.minimumAmount,
    maximumAmount: plan.maximumAmount,
    // Uncapped stake means uncapped earnings; a figure here would be invented.
    maxEarn: plan.maximumAmount === null ? null : (plan.maximumAmount * total) / 100,
    currency: plan.currency,
  }
}

export function PlanCard({
  plan,
  terms,
  onInvest,
}: {
  plan: InvestmentPlan
  terms: PlanCardTerms
  onInvest: () => void
}) {
  const range =
    terms.minimumAmount === null && terms.maximumAmount === null
      ? 'Any amount'
      : terms.maximumAmount === null
        ? `$${formatMoney(terms.minimumAmount ?? 0)} and up`
        : `$${formatMoney(terms.minimumAmount ?? 0)} – $${formatMoney(terms.maximumAmount)}`

  return (
    <article className="flex h-full w-full flex-col rounded-xl border border-line bg-surface p-5 text-center shadow-card">
      <h3 className="text-base font-bold uppercase tracking-wide text-ink">{plan.name}</h3>

      <p className="mt-1 text-[13px] text-accent">Total {terms.totalRatePercent}% ROI</p>

      <p className="num mt-3 text-[40px] font-bold leading-none tracking-tight text-ink">
        {terms.perPeriodPercent.toFixed(2)}%
      </p>

      <p className="mt-2.5 text-[11px] uppercase leading-relaxed tracking-wide text-muted">
        Every 24 hours for {terms.periods} {terms.periods === 1 ? 'day' : 'days'}
      </p>

      {/* flex-1 absorbs the height difference so buttons line up across a row */}
      <dl className="mt-5 flex-1 text-left">
        <Term label="Investment">{range}</Term>
        <Term label="Max. Earn">
          {terms.maxEarn === null ? 'Uncapped' : `${formatMoney(terms.maxEarn)} ${terms.currency}`}
        </Term>
        <Term label="Total Return">capital + {terms.totalRatePercent}%</Term>
      </dl>

      <Button variant="navy" fullWidth onClick={onInvest} className="mt-5">
        Invest Now
      </Button>
    </article>
  )
}
