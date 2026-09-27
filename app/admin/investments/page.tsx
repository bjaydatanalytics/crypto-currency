import { AdminShell } from '@/components/admin/admin-shell'
import { InvestmentReview } from '@/components/admin/investment-review'

export default function AdminInvestmentsPage() {
  return (
    <AdminShell
      data="live"
      title="Investments"
      description="Contracts, maturities and treasury solvency"
    >
      <InvestmentReview />
    </AdminShell>
  )
}
