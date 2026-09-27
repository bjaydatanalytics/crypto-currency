import { AdminNotice } from '@/components/admin/admin-notice'
import { AdminShell } from '@/components/admin/admin-shell'
import { AdminTransactions } from '@/components/admin/admin-transactions'

export default function AdminTransactionsPage() {
  return (
    <AdminShell data="mock" title="Transactions" description="All ledger activity">
      <div className="space-y-6">
        <AdminNotice />
        <AdminTransactions title="All transactions" />
      </div>
    </AdminShell>
  )
}
