import { badRequest, ok, withErrorHandling } from '@/lib/server/api'
import { requireAdmin } from '@/lib/server/guard'
import { listWithdrawalsForReview } from '@/lib/server/transfers'
import { withdrawalReviewQuerySchema } from '@/lib/server/validation'

/** GET — withdrawals, for review. Newest first. */
export const GET = withErrorHandling(async (request: Request) => {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const url = new URL(request.url)
  const parsed = withdrawalReviewQuerySchema.safeParse(Object.fromEntries(url.searchParams))
  if (!parsed.success) return badRequest('Invalid query parameters.')

  return ok({ withdrawals: await listWithdrawalsForReview(parsed.data) })
})
