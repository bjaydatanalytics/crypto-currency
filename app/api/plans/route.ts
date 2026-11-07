import { ok, withErrorHandling } from '@/lib/server/api'
import { listPublicPlans } from '@/lib/server/plans'
import type { PlanCategory } from '@/lib/types'

/**
 * Published plans. Public — no authentication.
 *
 * `listPublicPlans` filters to published rows in the query itself, so a draft
 * cannot reach this response by omission. Unpublished terms are visible only
 * through the admin endpoint.
 *
 * `?category=retirement` narrows to the 401k catalogue. An unrecognised value
 * is ignored rather than erroring: the honest response to "show me plans" is
 * every plan, and a typo in a query string should not blank the page.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const raw = new URL(request.url).searchParams.get('category')
  const category: PlanCategory | undefined =
    raw === 'standard' || raw === 'retirement' ? raw : undefined

  return ok(await listPublicPlans(category))
})
