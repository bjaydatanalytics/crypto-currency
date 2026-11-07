import { z } from 'zod'
import {
  badRequest,
  conflict,
  created,
  ok,
  parseBody,
  withErrorHandling,
} from '@/lib/server/api'
import { AddressValidationError } from '@/lib/server/address-validation'
import { requireKycVerified } from '@/lib/server/guard'
import {
  addWithdrawalAddress,
  listPendingWithdrawalAddresses,
  listUsableWithdrawalAddresses,
} from '@/lib/server/transfers'
import { DEPOSIT_NETWORK_IDS } from '@/lib/deposit-networks'

/**
 * The customer's payout addresses.
 *
 * These existed in the service layer but no route exposed them, so there was
 * no way for a customer to add one — and a withdrawal cannot be requested
 * without one, because payouts go only to addresses allow-listed in advance.
 *
 * Both methods require verified KYC, matching `POST /api/wallet/withdrawals`.
 * Gating the address list more loosely would be pointless: an address you may
 * add but never withdraw to is not useful, and the looser gate would be the
 * one an attacker probes.
 */

const addAddressSchema = z.object({
  assetId: z.string().trim().min(1).max(32),
  network: z.enum(DEPOSIT_NETWORK_IDS as [string, ...string[]]),
  address: z.string().trim().min(8).max(128),
  /** Required on memo networks; validated against the network server-side. */
  addressTag: z.string().trim().max(64).optional(),
  label: z.string().trim().max(64).optional(),
})

/**
 * GET — addresses this user can withdraw to, plus those still cooling off.
 *
 * `pending` is returned rather than hidden so the UI can explain why a newly
 * added address is not selectable yet. Silently omitting it reads as the
 * address having failed to save.
 */
export const GET = withErrorHandling(async () => {
  const guard = await requireKycVerified()
  if (!guard.ok) return guard.response

  const [usable, pending] = await Promise.all([
    listUsableWithdrawalAddresses(guard.user.id),
    listPendingWithdrawalAddresses(guard.user.id),
  ])

  const shape = (row: Awaited<ReturnType<typeof listUsableWithdrawalAddresses>>[number]) => ({
    id: row.id,
    assetId: row.assetId,
    network: row.network,
    address: row.address,
    addressTag: row.addressTag,
    label: row.label,
    activeFrom: row.activeFrom.toISOString(),
  })

  return ok({ addresses: usable.map(shape), pending: pending.map(shape) })
})

/** POST — add an address. It enters a cooling-off window before it is usable. */
export const POST = withErrorHandling(async (request: Request) => {
  const guard = await requireKycVerified()
  if (!guard.ok) return guard.response

  const body = await parseBody(request, addAddressSchema)
  if (!body.success) return body.response

  try {
    const row = await addWithdrawalAddress({
      userId: guard.user.id,
      userEmail: guard.user.email,
      ...body.data,
    })

    return created({
      address: {
        id: row.id,
        assetId: row.assetId,
        network: row.network,
        address: row.address,
        addressTag: row.addressTag,
        label: row.label,
        activeFrom: row.activeFrom.toISOString(),
      },
      message:
        'Address saved. It becomes available for withdrawals after a short cooling-off ' +
        'period — that delay is what stops a stolen session draining funds to a new address.',
    })
  } catch (error) {
    if (error instanceof AddressValidationError) return badRequest(error.message)
    // The unique index on (user, asset, address) rejects a duplicate.
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) {
      return conflict('You have already saved that address for this asset.')
    }
    throw error
  }
})
