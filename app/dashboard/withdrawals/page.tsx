import type { Metadata } from 'next'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { WithdrawForm, WithdrawHistoryLink } from '@/components/dashboard/withdraw-form'

export const metadata: Metadata = { title: 'Withdraw' }

/**
 * Withdraw funds.
 *
 * The source design said funds come "only from the Interest Wallet". That is
 * not how this ledger works — there is one spendable balance per asset, and
 * interest already paid sits inside it — so the copy below states the rule
 * that actually applies instead of one the system would not enforce.
 */
export default function WithdrawalsPage() {
  return (
    <>
      <DashboardHeader title="Withdraw" />

      <div className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold tracking-tight text-ink">Withdraw Funds</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Withdrawals are paid from your available balance, which includes any interest
              already credited to you. Anything locked in a running plan or an earlier
              withdrawal request cannot be withdrawn until it is released.
            </p>
          </div>
          <div className="shrink-0">
            <WithdrawHistoryLink />
          </div>
        </div>

        <div className="max-w-2xl">
          <WithdrawForm />
        </div>
      </div>
    </>
  )
}
