import { badRequest, conflict, notFound, ok, parseBody, withErrorHandling } from '@/lib/server/api'
import { requireAdmin } from '@/lib/server/guard'
import { getRequestContext } from '@/lib/server/session'
import {
  creditConfirmedDeposit,
  DepositError,
  rejectDeposit,
  updateDepositConfirmations,
} from '@/lib/server/transfers'
import { depositActionSchema } from '@/lib/server/validation'

/**
 * POST — act on a recorded deposit.
 *
 * `credit` is the only action in this codebase that increases a customer's
 * balance. It is deliberately a separate request from recording the deposit,
 * requires the confirmation threshold to have been met, and is idempotent:
 * clicking it twice credits once, guarded both by the row's status and by the
 * ledger's own idempotency key.
 *
 * `reject` leaves the row in place with its reason. Nothing is deleted —
 * "we have no record of it" is the worst possible answer to a customer whose
 * money is missing.
 */
export const POST = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.response

    const body = await parseBody(request, depositActionSchema)
    if (!body.success) return body.response

    const { id } = await params
    const actor = { id: guard.user.id, context: await getRequestContext() }

    try {
      switch (body.data.action) {
        case 'credit': {
          const credited = await creditConfirmedDeposit(id, actor)
          return ok({
            id,
            credited,
            message: credited
              ? 'Credited. The balance now reflects it and the ledger entry is permanent.'
              : 'Already credited — nothing changed.',
          })
        }

        case 'reject': {
          const rejected = await rejectDeposit(id, body.data.reason, actor)
          return ok({
            id,
            rejected,
            message: rejected
              ? 'Rejected. No balance changed and the record is kept with your reason.'
              : 'Already rejected — nothing changed.',
          })
        }

        case 'confirmations': {
          const result = await updateDepositConfirmations(id, body.data.confirmations)
          return ok({
            id,
            ...result,
            message: result.creditable
              ? 'Confirmation threshold met. This deposit can now be credited.'
              : `${result.confirmations} of ${result.required} confirmations.`,
          })
        }
      }
    } catch (error) {
      if (error instanceof DepositError) {
        switch (error.code) {
          case 'not_found':
            return notFound(error.message)
          case 'already_credited':
          case 'already_rejected':
            return conflict(error.message)
          default:
            return badRequest(error.message)
        }
      }
      throw error
    }
  },
)
