import { AdminShell } from '@/components/admin/admin-shell'
import { DepositReview } from '@/components/admin/deposit-review'

export default function AdminDepositsPage() {
  return (
    <AdminShell data="live"
      title="Deposits"
      description="Record arrived transfers and credit them to the ledger"
    >
      <DepositReview />
    </AdminShell>
  )
}
