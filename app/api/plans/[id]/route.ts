import { notFound, ok, withErrorHandling } from '@/lib/server/api'
import { getPublicPlan } from '@/lib/server/plans'

/**
 * A single published plan. Public — no authentication.
 *
 * An unpublished plan returns 404 rather than 403: whether a draft exists is
 * not something a visitor needs to know.
 */
export const GET = withErrorHandling(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const plan = await getPublicPlan(id)

    if (!plan) return notFound('No such plan.')
    return ok(plan)
  },
)
