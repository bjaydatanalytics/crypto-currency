import { ok, withErrorHandling } from '@/lib/server/api'
import { listPublicPlans } from '@/lib/server/plans'

/**
 * Published plans. Public — no authentication.
 *
 * `listPublicPlans` filters to published rows in the query itself, so a draft
 * cannot reach this response by omission. Unpublished terms are visible only
 * through the admin endpoint.
 */
export const GET = withErrorHandling(async () => {
  return ok(await listPublicPlans())
})
