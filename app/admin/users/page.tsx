import { AdminShell } from '@/components/admin/admin-shell'
import { UserReview } from '@/components/admin/user-review'
import { gateAdmin } from '@/lib/server/auth-gate'

/**
 * Users and identity verification.
 *
 * A server component so the signed-in admin's id can reach the table: the API
 * refuses an admin acting on their own account, and the UI should show that
 * rather than offering buttons that will be rejected.
 *
 * The layout already calls `gateAdmin()`; calling it again here is cheap and
 * keeps this page correct if it is ever moved out from under that layout.
 */
export default async function AdminUsersPage() {
  const admin = await gateAdmin()

  return (
    <AdminShell
      data="live"
      title="Users"
      description="Accounts, identity verification and access"
    >
      <UserReview currentAdminId={admin?.id} />
    </AdminShell>
  )
}
