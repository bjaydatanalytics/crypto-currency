import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { TransactionHistory } from '@/components/dashboard/transaction-history'

export default function TransactionsPage() {
  return (
    <>
      <DashboardHeader title="Transactions" />

      <div className="space-y-6 p-4 sm:p-6">
        

        <TransactionHistory />
      </div>
    </>
  )
}
