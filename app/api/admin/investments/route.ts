import { badRequest, ok, withErrorHandling } from '@/lib/server/api'
import { requireAdmin } from '@/lib/server/guard'
import { listAllInvestments } from '@/lib/server/investments'
import { investmentQuerySchema } from '@/lib/server/validation'

/** GET — every contract, newest first. */
export const GET = withErrorHandling(async (request: Request) => {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const url = new URL(request.url)
  const parsed = investmentQuerySchema.safeParse(Object.fromEntries(url.searchParams))
  if (!parsed.success) return badRequest('Invalid query parameters.')

  return ok({ investments: await listAllInvestments(parsed.data.status) })
})
