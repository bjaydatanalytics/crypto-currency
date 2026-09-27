import {
  badRequest,
  conflict,
  created,
  notFound,
  ok,
  parseBody,
  withErrorHandling,
} from '@/lib/server/api'
import { requireKycVerified, requireVerifiedUser } from '@/lib/server/guard'
import { InvestmentError, listUserInvestments, subscribeToPlan } from '@/lib/server/investments'
import { getRequestContext } from '@/lib/server/session'
import { investmentQuerySchema, subscribeToPlanSchema } from '@/lib/server/validation'

/** GET — the signed-in user's own contracts. */
export const GET = withErrorHandling(async (request: Request) => {
  const guard = await requireVerifiedUser()
  if (!guard.ok) return guard.response

  const url = new URL(request.url)
  const parsed = investmentQuerySchema.safeParse(Object.fromEntries(url.searchParams))
  if (!parsed.success) return badRequest('Invalid query parameters.')

  return ok({ investments: await listUserInvestments(guard.user.id, parsed.data.status) })
})

/**
 * POST — subscribe to a plan.
 *
 * Requires completed KYC: this locks the customer's funds into a contract, and
 * taking money from an unverified person is what anti-money-laundering rules
 * prohibit. The same gate guards deposits and withdrawals.
 *
 * Nothing leaves the platform here. The principal moves from available to
 * locked, and the terms in force at this moment are copied onto the contract so
 * a later plan edit cannot change what was agreed.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const guard = await requireKycVerified()
  if (!guard.ok) return guard.response

  const body = await parseBody(request, subscribeToPlanSchema)
  if (!body.success) return body.response

  try {
    const investment = await subscribeToPlan({
      userId: guard.user.id,
      planId: body.data.planId,
      assetId: body.data.assetId,
      amount: body.data.amount,
      idempotencyKey: body.data.idempotencyKey,
      context: await getRequestContext(),
    })

    return created({
      investment,
      message:
        `Your ${investment.principal} ${investment.assetSymbol} is locked until ` +
        `${new Date(investment.maturesAt).toDateString()}. ` +
        `${investment.expectedReturn} ${investment.assetSymbol} is owed to you on maturity.`,
    })
  } catch (error) {
    if (error instanceof InvestmentError) {
      switch (error.code) {
        case 'unknown_plan':
        case 'unknown_asset':
          return notFound(error.message)
        case 'insufficient_funds':
          return conflict(error.message)
        default:
          return badRequest(error.message)
      }
    }
    throw error
  }
})
