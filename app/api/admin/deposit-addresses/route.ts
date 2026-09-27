import {
  badRequest,
  conflict,
  created,
  ok,
  parseBody,
  withErrorHandling,
} from '@/lib/server/api'
import {
  createPlatformAddress,
  DepositAddressError,
  listPlatformAddresses,
  listUsersAwaitingAddress,
} from '@/lib/server/deposit-addresses'
import { requireAdmin } from '@/lib/server/guard'
import { getRequestContext } from '@/lib/server/session'
import { createDepositAddressSchema, depositAddressQuerySchema } from '@/lib/server/validation'

/**
 * The platform's pool of receiving addresses.
 *
 * GET lists them with a live count of how many users each is shown to, plus the
 * users who have no address at all — the operational gap that matters, since
 * those are verified customers with nowhere to send funds.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const url = new URL(request.url)
  const parsed = depositAddressQuerySchema.safeParse(Object.fromEntries(url.searchParams))
  if (!parsed.success) return badRequest('Invalid query parameters.')

  const [addresses, awaiting] = await Promise.all([
    listPlatformAddresses(parsed.data),
    listUsersAwaitingAddress(),
  ])

  return ok({
    addresses,
    usersAwaitingAddress: awaiting.map((user) => ({
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      kycStatus: user.kycStatus,
      joined: user.createdAt.toISOString(),
    })),
  })
})

/**
 * POST — record a new receiving address.
 *
 * The address is checksum-validated before it is stored. This is the one place
 * in the system where a human types a destination that other people's money
 * will be sent to, so it fails closed on anything it cannot verify.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const body = await parseBody(request, createDepositAddressSchema)
  if (!body.success) return body.response

  try {
    const address = await createPlatformAddress(
      {
        assetId: body.data.assetId,
        network: body.data.network,
        address: body.data.address,
        addressTag: body.data.addressTag || null,
        label: body.data.label,
        custodian: body.data.custodian,
        notes: body.data.notes || null,
      },
      { id: guard.user.id, context: await getRequestContext() },
    )

    return created(address)
  } catch (error) {
    if (error instanceof DepositAddressError) {
      if (error.code === 'duplicate') return conflict(error.message)
      return badRequest(error.message, { address: error.message })
    }
    throw error
  }
})
