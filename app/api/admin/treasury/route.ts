import { badRequest, created, ok, parseBody, withErrorHandling } from '@/lib/server/api'
import { requireAdmin } from '@/lib/server/guard'
import { fundTreasury, getTreasuryPositions, InvestmentError } from '@/lib/server/investments'
import { getRequestContext } from '@/lib/server/session'
import { fundTreasurySchema } from '@/lib/server/validation'

/**
 * GET — treasury solvency, per asset.
 *
 * `committed` is the total return owed on contracts not yet matured. A negative
 * `surplus` is not a projection: the shortfall exists now and will surface as a
 * failed maturity on a date already fixed by the contracts.
 */
export const GET = withErrorHandling(async () => {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const positions = await getTreasuryPositions()

  return ok({
    positions,
    /** True only when every asset can cover what it owes. */
    solvent: positions.every((position) => position.funded),
  })
})

/**
 * POST — record the business putting its own money in.
 *
 * Debits `external` and credits `platform_treasury`, the same shape as a
 * customer deposit, because that is what it is: funds entering from outside.
 *
 * As with a customer deposit, **the money must already have moved.** Recording
 * a funding that did not happen inflates the treasury on paper and lets a
 * maturity pay out against nothing.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const body = await parseBody(request, fundTreasurySchema)
  if (!body.success) return body.response

  try {
    const result = await fundTreasury(
      {
        assetId: body.data.assetId,
        amount: body.data.amount,
        note: body.data.note || undefined,
        idempotencyKey: body.data.idempotencyKey,
      },
      { id: guard.user.id, context: await getRequestContext() },
    )

    return created({
      ...result,
      message: `Treasury now holds ${result.balance} ${result.assetId.toUpperCase()}.`,
    })
  } catch (error) {
    if (error instanceof InvestmentError) return badRequest(error.message)
    throw error
  }
})
