import { badRequest, conflict, notFound, ok, parseBody, withErrorHandling } from '@/lib/server/api'
import { requireAdmin } from '@/lib/server/guard'
import { cancelInvestment, InvestmentError, matureInvestment } from '@/lib/server/investments'
import { getRequestContext } from '@/lib/server/session'
import { adminInvestmentActionSchema } from '@/lib/server/validation'

/**
 * POST — act on one contract.
 *
 * `mature` pays principal plus the promised return, debiting the treasury. It
 * refuses when the treasury cannot cover it, and that refusal is the point: the
 * alternative is paying one customer's return out of another's deposit while
 * the ledger still appears to balance.
 *
 * `cancel` returns the principal in full and pays no return. There are no
 * early-exit terms, so keeping any part of the stake would be a penalty nobody
 * agreed to.
 */
export const POST = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.response

    const body = await parseBody(request, adminInvestmentActionSchema)
    if (!body.success) return body.response

    const { id } = await params
    const context = await getRequestContext()

    try {
      if (body.data.action === 'mature') {
        const investment = await matureInvestment(id, { id: guard.user.id, context })
        return ok({
          investment,
          message:
            `Paid ${investment.principal} + ${investment.expectedReturn} ` +
            `${investment.assetSymbol}. The treasury covered the return.`,
        })
      }

      const investment = await cancelInvestment(id, body.data.reason, {
        id: guard.user.id,
        role: 'admin',
        context,
      })
      return ok({
        investment,
        message: `Cancelled. ${investment.principal} ${investment.assetSymbol} returned in full, no return paid.`,
      })
    } catch (error) {
      if (error instanceof InvestmentError) {
        switch (error.code) {
          case 'not_found':
            return notFound(error.message)
          case 'wrong_status':
            return conflict(error.message)
          case 'treasury_short':
            // 409: the request was understood and refused because of state the
            // operator can fix by funding the treasury.
            return conflict(error.message)
          default:
            return badRequest(error.message)
        }
      }
      throw error
    }
  },
)
