import { getAccountSummary } from '@/lib/server/account-summary'
import { ok, withErrorHandling } from '@/lib/server/api'
import { requireUser } from '@/lib/server/guard'

/**
 * Headline figures for the customer dashboard.
 *
 * Any signed-in account may read this. Every figure a brand-new customer gets
 * back is legitimately zero, which is the honest answer — not an error.
 */
export const GET = withErrorHandling(async () => {
  const guard = await requireUser()
  if (!guard.ok) return guard.response

  return ok(await getAccountSummary(guard.user.id))
})
