import { AdminShell } from '@/components/admin/admin-shell'
import { DepositAddressManager } from '@/components/admin/deposit-address-manager'

export default function AdminDepositAddressesPage() {
  return (
    <AdminShell data="live"
      title="Deposit addresses"
      description="Receiving addresses and who each one is shown to"
    >
      <DepositAddressManager />
    </AdminShell>
  )
}
