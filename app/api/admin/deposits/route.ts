import {
  badRequest,
  conflict,
  created,
  ok,
  parseBody,
  withErrorHandling,
} from '@/lib/server/api'
import { requireAdmin } from '@/lib/server/guard'
import { getRequestContext } from '@/lib/server/session'
import { DepositError, listDepositsForReview, recordDepositArrival } from '@/lib/server/transfers'
import { depositReviewQuerySchema, recordDepositSchema } from '@/lib/server/validation'

/** GET — deposits, for review. Defaults to everything, newest first. */
export const GET = withErrorHandling(async (request: Request) => {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const url = new URL(request.url)
  const parsed = depositReviewQuerySchema.safeParse(Object.fromEntries(url.searchParams))
  if (!parsed.success) return badRequest('Invalid query parameters.')

  return ok({ deposits: await listDepositsForReview(parsed.data) })
})

/**
 * POST — record a deposit that has arrived.
 *
 * Records the claim; it does not credit it. Crediting is a second, separate
 * request against the created row, so an operator can check what they entered
 * against the exchange before a balance changes. See `recordDepositArrival`.
 *
 * The deposit is bound to the address the user was actually assigned, so a
 * deposit cannot be recorded for someone who was never given anywhere to send
 * funds — which would mean the money arrived somewhere unexplained.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const body = await parseBody(request, recordDepositSchema)
  if (!body.success) return body.response

  try {
    const deposit = await recordDepositArrival(
      {
        userId: body.data.userId,
        assetId: body.data.assetId,
        network: body.data.network,
        amount: body.data.amount,
        txHash: body.data.txHash,
        confirmations: body.data.confirmations,
        notes: body.data.notes || undefined,
      },
      { id: guard.user.id, context: await getRequestContext() },
    )

    return created({
      id: deposit.id,
      status: deposit.status,
      confirmations: deposit.confirmations,
      requiredConfirmations: deposit.requiredConfirmations,
      creditable: deposit.confirmations >= deposit.requiredConfirmations,
      message:
        deposit.confirmations >= deposit.requiredConfirmations
          ? 'Recorded. Nothing has been credited yet — review it, then credit it.'
          : `Recorded. It needs ${deposit.requiredConfirmations} confirmations before it can be credited.`,
    })
  } catch (error) {
    if (error instanceof DepositError) {
      return error.code === 'duplicate_tx' ? conflict(error.message) : badRequest(error.message)
    }
    throw error
  }
})
