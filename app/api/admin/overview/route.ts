import { ok, withErrorHandling } from '@/lib/server/api'
import { getAdminOverview } from '@/lib/server/admin-overview'
import { requireAdmin } from '@/lib/server/guard'

/**
 * GET — the admin work queue and platform totals.
 *
 * Replaces `/admin/stats` and `/admin/volume`, which the overview page called
 * but which were never written — so opening `/admin` in production threw a 500.
 * One request now, because the page renders one view and two round trips only
 * bought the chance of a half-loaded dashboard.
 */
export const GET = withErrorHandling(async () => {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  return ok(await getAdminOverview())
})
