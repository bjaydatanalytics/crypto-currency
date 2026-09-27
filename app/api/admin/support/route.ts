import { badRequest, ok, withErrorHandling } from '@/lib/server/api'
import { requireAdmin } from '@/lib/server/guard'
import { countTicketsAwaitingSupport, listAdminTickets } from '@/lib/server/support'
import { ticketQuerySchema } from '@/lib/server/validation'

/**
 * GET — the support queue.
 *
 * Ordered so the answer to "what needs me now" is the top of the list:
 * awaiting-support first, then by priority, then **oldest first**. Sorting
 * newest-first would bury whoever has been waiting longest, which is exactly
 * backwards for a support queue.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const url = new URL(request.url)
  const parsed = ticketQuerySchema.safeParse(Object.fromEntries(url.searchParams))
  if (!parsed.success) return badRequest('Invalid query parameters.')

  const [tickets, awaiting] = await Promise.all([
    listAdminTickets(parsed.data),
    countTicketsAwaitingSupport(),
  ])

  return ok({ tickets, awaitingSupport: awaiting })
})
