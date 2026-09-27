import { badRequest, conflict, created, ok, parseBody, withErrorHandling } from '@/lib/server/api'
import { requireAdmin } from '@/lib/server/guard'
import { createPlan, listAllPlans, PlanError } from '@/lib/server/plans'
import { getRequestContext } from '@/lib/server/session'
import { createPlanSchema } from '@/lib/server/validation'

/** GET — every plan, drafts included. Admin-only; the public list filters drafts out. */
export const GET = withErrorHandling(async () => {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  return ok({ plans: await listAllPlans() })
})

/**
 * POST — create a plan.
 *
 * Whatever is published here is shown to prospective customers, which in most
 * jurisdictions makes it a financial promotion. The schema has no field for a
 * rate of return or a projected profit, and `riskDisclosure` is required — the
 * shape of the request is the control, not a warning the operator can ignore.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const body = await parseBody(request, createPlanSchema)
  if (!body.success) return body.response

  try {
    const plan = await createPlan(body.data, {
      id: guard.user.id,
      context: await getRequestContext(),
    })
    return created(plan)
  } catch (error) {
    if (error instanceof PlanError) {
      return error.code === 'duplicate' ? conflict(error.message) : badRequest(error.message)
    }
    throw error
  }
})
