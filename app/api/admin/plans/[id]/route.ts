import { badRequest, notFound, ok, parseBody, withErrorHandling } from '@/lib/server/api'
import { requireAdmin } from '@/lib/server/guard'
import { deletePlan, PlanError, updatePlan } from '@/lib/server/plans'
import { getRequestContext } from '@/lib/server/session'
import { updatePlanSchema } from '@/lib/server/validation'

/**
 * PATCH — update a plan's terms.
 *
 * Partial by design, but the amount range is re-checked against the stored row
 * rather than only the submitted fields, so sending one side of the pair
 * cannot slip a maximum below a minimum. The previous values go into the audit
 * entry: these are the terms a customer was shown, and "what did this plan say
 * last month" has to stay answerable.
 */
export const PATCH = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.response

    const body = await parseBody(request, updatePlanSchema)
    if (!body.success) return body.response

    const { id } = await params

    try {
      const plan = await updatePlan(id, body.data, {
        id: guard.user.id,
        context: await getRequestContext(),
      })
      return ok(plan)
    } catch (error) {
      if (error instanceof PlanError) {
        return error.code === 'not_found' ? notFound(error.message) : badRequest(error.message)
      }
      throw error
    }
  },
)

/**
 * DELETE — remove a plan.
 *
 * Safe only while nothing references a plan id. Once subscriptions exist this
 * should become an unpublish: deleting terms somebody is signed up under
 * destroys the record of what they agreed to. The full row is copied into the
 * audit entry because afterwards there is nothing else left to inspect.
 */
export const DELETE = withErrorHandling(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.response

    const { id } = await params

    try {
      await deletePlan(id, { id: guard.user.id, context: await getRequestContext() })
      return ok({ id, deleted: true, message: 'Plan deleted. It is no longer shown anywhere.' })
    } catch (error) {
      if (error instanceof PlanError) {
        return error.code === 'not_found' ? notFound(error.message) : badRequest(error.message)
      }
      throw error
    }
  },
)
