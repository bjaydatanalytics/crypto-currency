import { AdminShell } from '@/components/admin/admin-shell'
import { SupportQueue } from '@/components/admin/support-queue'
import { gateAdmin } from '@/lib/server/auth-gate'

/**
 * Support queue.
 *
 * A server component so the operator's own id reaches the thread view, which
 * needs it for "assign to me".
 */
export default async function AdminSupportPage() {
  const admin = await gateAdmin()

  return (
    <AdminShell
      data="live"
      title="Support"
      description="Customer tickets, replies and internal notes"
    >
      <SupportQueue currentAdminId={admin?.id} />
    </AdminShell>
  )
}
