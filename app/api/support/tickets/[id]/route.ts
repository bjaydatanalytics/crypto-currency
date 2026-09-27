import { badRequest, conflict, created, notFound, ok, parseBody, withErrorHandling } from '@/lib/server/api'
import { requireVerifiedUser } from '@/lib/server/guard'
import { getRequestContext } from '@/lib/server/session'
import { addTicketMessage, getUserTicket, SupportError } from '@/lib/server/support'
import { ticketReplySchema } from '@/lib/server/validation'

/**
 * GET — one of the caller's own tickets, with its messages.
 *
 * `getUserTicket` takes the user id as well as the ticket id and filters
 * internal notes inside the query. There is no id-only read on the customer
 * path, so this cannot accidentally serve another customer's thread or an
 * operator's private notes.
 */
export const GET = withErrorHandling(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const guard = await requireVerifiedUser()
    if (!guard.ok) return guard.response

    const { id } = await params

    try {
      return ok(await getUserTicket(guard.user.id, id))
    } catch (error) {
      if (error instanceof SupportError) return notFound(error.message)
      throw error
    }
  },
)

/** POST — the customer replies on their own ticket. */
export const POST = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const guard = await requireVerifiedUser()
    if (!guard.ok) return guard.response

    const body = await parseBody(request, ticketReplySchema)
    if (!body.success) return body.response

    const { id } = await params

    try {
      const message = await addTicketMessage({
        ticketId: id,
        authorId: guard.user.id,
        authorRole: 'user',
        body: body.data.body,
        // Scoped to the caller: a customer can only post to their own ticket.
        restrictToUserId: guard.user.id,
        context: await getRequestContext(),
      })

      return created({ message, status: 'awaiting_support' })
    } catch (error) {
      if (error instanceof SupportError) {
        if (error.code === 'not_found') return notFound(error.message)
        if (error.code === 'closed') return conflict(error.message)
        return badRequest(error.message)
      }
      throw error
    }
  },
)
