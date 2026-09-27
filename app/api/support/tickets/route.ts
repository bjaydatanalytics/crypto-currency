import { created, fail, ok, parseBody, withErrorHandling } from '@/lib/server/api'
import { requireVerifiedUser } from '@/lib/server/guard'
import { checkRateLimit, RULES } from '@/lib/server/rate-limit'
import { getRequestContext } from '@/lib/server/session'
import { createTicket, listUserTickets } from '@/lib/server/support'
import { createTicketSchema } from '@/lib/server/validation'

/** GET — the signed-in customer's own tickets. */
export const GET = withErrorHandling(async () => {
  const guard = await requireVerifiedUser()
  if (!guard.ok) return guard.response

  return ok({ tickets: await listUserTickets(guard.user.id) })
})

/**
 * POST — open a ticket.
 *
 * Rate limited per account. Ticket creation writes rows and sends no mail, so
 * it is not an amplification vector, but an unbounded endpoint lets one account
 * flood the queue and bury everybody else's genuine problem.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const guard = await requireVerifiedUser()
  if (!guard.ok) return guard.response

  const limit = await checkRateLimit(`support-ticket:${guard.user.id}`, RULES.kycSubmit)
  if (!limit.allowed) {
    return fail(
      'rate_limited',
      'You have opened several tickets recently. Reply on an existing one instead, or try again later.',
      429,
    )
  }

  const body = await parseBody(request, createTicketSchema)
  if (!body.success) return body.response

  const result = await createTicket(
    {
      userId: guard.user.id,
      subject: body.data.subject,
      category: body.data.category,
      body: body.data.body,
    },
    await getRequestContext(),
  )

  return created({
    ...result,
    message: 'Ticket opened. You will be emailed when support replies.',
  })
})
