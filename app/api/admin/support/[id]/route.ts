import { badRequest, conflict, notFound, ok, parseBody, withErrorHandling } from '@/lib/server/api'
import { requireAdmin } from '@/lib/server/guard'
import { getRequestContext } from '@/lib/server/session'
import {
  addTicketMessage,
  assignTicket,
  getAdminTicket,
  setTicketPriority,
  setTicketStatus,
  SupportError,
} from '@/lib/server/support'
import { adminTicketActionSchema } from '@/lib/server/validation'

/** GET — one ticket with every message, internal notes included. */
export const GET = withErrorHandling(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.response

    const { id } = await params

    try {
      return ok(await getAdminTicket(id))
    } catch (error) {
      if (error instanceof SupportError) return notFound(error.message)
      throw error
    }
  },
)

/**
 * POST — act on a ticket.
 *
 * `reply` with `internal: true` writes a private note: it is not shown to the
 * customer, does not email them, and does not move the ticket out of
 * "awaiting support" — because a note to yourself is not an answer.
 */
export const POST = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.response

    const body = await parseBody(request, adminTicketActionSchema)
    if (!body.success) return body.response

    const { id } = await params
    const context = await getRequestContext()

    try {
      switch (body.data.action) {
        case 'reply': {
          const message = await addTicketMessage({
            ticketId: id,
            authorId: guard.user.id,
            authorRole: 'admin',
            body: body.data.body,
            internal: body.data.internal,
            context,
          })
          return ok({
            message,
            ticket: (await getAdminTicket(id)).ticket,
            note: body.data.internal
              ? 'Internal note saved. The customer cannot see it and was not emailed.'
              : 'Reply sent. The customer has been emailed that there is a new message.',
          })
        }

        case 'status': {
          const ticket = await setTicketStatus(id, body.data.status, {
            id: guard.user.id,
            context,
          })
          return ok({ ticket, note: `Marked ${body.data.status.replace('_', ' ')}.` })
        }

        case 'assign': {
          const ticket = await assignTicket(id, body.data.assignedTo, {
            id: guard.user.id,
            context,
          })
          return ok({
            ticket,
            note: body.data.assignedTo ? 'Assigned.' : 'Returned to the unassigned queue.',
          })
        }

        case 'priority': {
          const ticket = await setTicketPriority(id, body.data.priority, {
            id: guard.user.id,
            context,
          })
          return ok({ ticket, note: `Priority set to ${body.data.priority}.` })
        }
      }
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
