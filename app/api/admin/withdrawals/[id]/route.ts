import { badRequest, conflict, forbidden, notFound, ok, parseBody, withErrorHandling } from '@/lib/server/api'
import { requireAdmin } from '@/lib/server/guard'
import { getRequestContext } from '@/lib/server/session'
import {
  approveWithdrawal,
  rejectWithdrawal,
  settleWithdrawal,
  WithdrawalError,
} from '@/lib/server/transfers'
import { withdrawalActionSchema } from '@/lib/server/validation'

/**
 * POST — act on a withdrawal.
 *
 * The three actions map onto a flow with no custodian in it, where a person
 * sends the payment by hand:
 *
 *   approve  — cleared for payment. Funds stay locked; nothing has been sent.
 *   settle   — the payment went out. Requires the transaction hash, and only
 *              then do the funds leave the ledger.
 *   reject   — the locked funds are returned to the customer's balance.
 *
 * Approve and settle are separate because collapsing them would mean approving
 * *is* paying, with no step in between where a wrong destination is caught.
 * `settle` refuses on anything not already approved, so the order cannot be
 * skipped by calling the endpoints out of sequence.
 */
export const POST = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.response

    const body = await parseBody(request, withdrawalActionSchema)
    if (!body.success) return body.response

    const { id } = await params
    const context = await getRequestContext()

    try {
      switch (body.data.action) {
        case 'approve': {
          const row = await approveWithdrawal(id, guard.user.id, context)
          return ok({
            id,
            status: row.status,
            message:
              'Approved. No funds have moved — send the payment, then record the transaction ' +
              'hash here to settle it.',
          })
        }

        case 'settle': {
          const settled = await settleWithdrawal(id, body.data.txHash, {
            id: guard.user.id,
            context,
          })
          return ok({
            id,
            settled,
            message: settled
              ? 'Settled. The funds have left the ledger and the customer can see the hash.'
              : 'Already settled — nothing changed.',
          })
        }

        case 'reject': {
          const rejected = await rejectWithdrawal(id, body.data.reason, guard.user.id, context)
          return ok({
            id,
            rejected,
            message: rejected
              ? 'Rejected. The locked funds are back in the customer’s available balance.'
              : 'Already rejected — nothing changed.',
          })
        }
      }
    } catch (error) {
      if (error instanceof WithdrawalError) {
        switch (error.code) {
          case 'not_found':
            return notFound(error.message)
          case 'self_approval':
            return forbidden(error.message)
          case 'wrong_status':
            return conflict(error.message)
          default:
            return badRequest(error.message)
        }
      }
      throw error
    }
  },
)
