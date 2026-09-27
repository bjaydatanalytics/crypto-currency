import { badRequest, conflict, created, ok, parseBody, withErrorHandling } from '@/lib/server/api'
import {
  assignAddressToUser,
  DepositAddressError,
  listAssignments,
} from '@/lib/server/deposit-addresses'
import { requireAdmin } from '@/lib/server/guard'
import { getRequestContext } from '@/lib/server/session'
import { assignDepositAddressSchema, assignmentQuerySchema } from '@/lib/server/validation'

/** GET — which users are currently shown which address. */
export const GET = withErrorHandling(async (request: Request) => {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const url = new URL(request.url)
  const parsed = assignmentQuerySchema.safeParse(Object.fromEntries(url.searchParams))
  if (!parsed.success) return badRequest('Invalid query parameters.')

  return ok({ assignments: await listAssignments(parsed.data) })
})

/**
 * POST — show a pool address to a user.
 *
 * Replaces any address that user currently holds for the same asset and
 * network, atomically. Two live assignments for one asset would mean two
 * screens showing two destinations, and only one of them being watched.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const body = await parseBody(request, assignDepositAddressSchema)
  if (!body.success) return body.response

  try {
    const assignment = await assignAddressToUser(body.data, {
      id: guard.user.id,
      context: await getRequestContext(),
    })
    return created(assignment)
  } catch (error) {
    if (error instanceof DepositAddressError) {
      if (error.code === 'inactive') return conflict(error.message)
      return badRequest(error.message)
    }
    throw error
  }
})
