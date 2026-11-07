'use client'

import { formatMoney } from '@/lib/utils'
import { SummaryCard } from './summary-card'
import { useSummary } from './summary-provider'

/**
 * The three headline cards: deposits, withdrawals and investments.
 *
 * A client component so it reads the shared summary context, which the layout
 * seeded server-side — there is no fetch here and no loading state, because
 * the figures are already present on first paint.
 *
 * Each card's footnote states what the figure covers. "0.00 USD" on its own is
 * ambiguous between "nothing has happened", "nothing has settled yet" and
 * "something failed", and those are three different things for the customer
 * to do next.
 */
export function DashboardSummary() {
  const { summary } = useSummary()
  const { deposits, withdrawals, investments } = summary

  const money = (value: number) => `$${formatMoney(value)}`

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <SummaryCard
        title="Successful Deposits"
        total={deposits.successful.usd}
        tone="blue"
        breakdown={[
          { label: 'Submitted', amount: deposits.submitted.usd },
          { label: 'Pending', amount: deposits.pending.usd },
          { label: 'Rejected', amount: deposits.rejected.usd },
        ]}
        note={
          deposits.count === 0 ? (
            'You have not made a deposit yet.'
          ) : (
            <>
              You have submitted {money(deposits.submitted.usd)} in deposits, of which{' '}
              {money(deposits.pending.usd)} is still confirming.
            </>
          )
        }
      />

      <SummaryCard
        title="Successful Withdrawals"
        total={withdrawals.successful.usd}
        tone="green"
        breakdown={[
          { label: 'Submitted', amount: withdrawals.submitted.usd },
          { label: 'Pending', amount: withdrawals.pending.usd },
          { label: 'Rejected', amount: withdrawals.rejected.usd },
        ]}
        note={
          withdrawals.count === 0 ? (
            'You have not requested a withdrawal yet.'
          ) : (
            <>
              You have requested {money(withdrawals.submitted.usd)} in withdrawals, of which{' '}
              {money(withdrawals.pending.usd)} is awaiting approval.
            </>
          )
        }
      />

      <SummaryCard
        title="Total Investments"
        total={investments.total.usd}
        tone="amber"
        breakdown={[
          { label: 'Completed', amount: investments.completed.usd },
          { label: 'Running', amount: investments.running.usd },
          { label: 'Interests', amount: investments.interests.usd },
        ]}
        note={
          investments.total.usd === 0 ? (
            'You have no investments yet.'
          ) : (
            <>
              {money(investments.running.usd)} is locked in {investments.activeCount} running{' '}
              {investments.activeCount === 1 ? 'plan' : 'plans'}, and{' '}
              {money(investments.interests.usd)} has been paid out as interest.
            </>
          )
        }
      />
    </div>
  )
}
