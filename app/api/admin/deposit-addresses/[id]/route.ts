import { badRequest, notFound, ok, parseBody, withErrorHandling } from '@/lib/server/api'
import { DepositAddressError, revokePlatformAddress } from '@/lib/server/deposit-addresses'
import { requireAdmin } from '@/lib/server/guard'
import { getRequestContext } from '@/lib/server/session'
import { updateDepositAddressSchema } from '@/lib/server/validation'

/**
 * PATCH — retire a receiving address.
 *
 * Retiring is the only mutation offered. An address cannot be *edited*: the
 * stored string is what users were told to send funds to, so changing it in
 * place would rewrite the record of what the platform actually displayed. To
 * change destination, retire this one and add a new one.
 *
 * Retiring also revokes every assignment pointing at it, in the same
 * transaction. The alternative — a retired address still on someone's deposit
 * screen — routes funds to an account nobody is reconciling any more.
 */
export const PATCH = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.response

    const body = await parseBody(request, updateDepositAddressSchema)
    if (!body.success) return body.response

    const { id } = await params

    try {
      const result = await revokePlatformAddress(id, {
        id: guard.user.id,
        context: await getRequestContext(),
      })

      return ok({
        id,
        status: 'revoked' as const,
        revokedAssignments: result.revokedAssignments,
        message:
          result.revokedAssignments > 0
            ? `Retired. ${result.revokedAssignments} user${result.revokedAssignments === 1 ? '' : 's'} no longer see this address and will need a new one before they can deposit.`
            : 'Retired. It was not assigned to anyone.',
      })
    } catch (error) {
      if (error instanceof DepositAddressError) {
        return error.code === 'not_found' ? notFound(error.message) : badRequest(error.message)
      }
      throw error
    }
  },
)
