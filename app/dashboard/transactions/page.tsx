import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { TransactionHistory } from '@/components/dashboard/transaction-history'
import { DemoNotice } from '@/components/ui/demo-notice'

export default function TransactionsPage() {
  return (
    <>
      <DashboardHeader title="Transactions" />

      <div className="space-y-6 p-4 sm:p-6">
        <DemoNotice>
          These records are sample data. They are not a statement of account and no transaction
          listed here took place.
        </DemoNotice>

        <TransactionHistory />
      </div>
    </>
  )
}
