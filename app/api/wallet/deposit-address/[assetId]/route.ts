import { notConfigured, ok, withErrorHandling } from '@/lib/server/api'
import { AuditAction, recordAudit } from '@/lib/server/audit'
import { DepositAddressNotAssignedError } from '@/lib/server/deposit-addresses'
import { requireKycVerified } from '@/lib/server/guard'
import { getRequestContext } from '@/lib/server/session'
import { getOrCreateDepositAddress } from '@/lib/server/transfers'

/**
 * Deposit address for an asset.
 *
 * Requires completed KYC — taking custody of funds from an unverified person is
 * exactly what anti-money-laundering rules prohibit.
 *
 * Returns only an address an operator has assigned to *this* user. When there
 * is none, it answers 503 with an explanation. It never returns a placeholder,
 * an example, a default or another account's address: whatever this endpoint
 * returns, someone will send real money to, and funds sent to the wrong
 * destination cannot be recovered by anyone.
 *
 * Each successful read is audited. If a user later disputes where they were
 * told to send funds, the trail is what answers the question.
 */
export const GET = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ assetId: string }> }) => {
    const guard = await requireKycVerified()
    if (!guard.ok) return guard.response

    const { assetId } = await params
    const network = new URL(request.url).searchParams.get('network') ?? undefined

    try {
      const address = await getOrCreateDepositAddress(guard.user.id, assetId, network)

      await recordAudit({
        actorId: guard.user.id,
        actorRole: 'user',
        action: AuditAction.DepositAddressViewed,
        targetType: 'asset',
        targetId: assetId,
        metadata: { address: address.address, network: address.network },
        context: await getRequestContext(),
      })

      return ok({ ...address, assetId })
    } catch (error) {
      if (error instanceof DepositAddressNotAssignedError) {
        return notConfigured(
          'Deposits for this asset',
          'No deposit address has been issued for your account yet. Contact support — and do ' +
            'not send funds to any address shown elsewhere for this account.',
        )
      }
      throw error
    }
  },
)
