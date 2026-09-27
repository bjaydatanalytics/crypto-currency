import { asc } from 'drizzle-orm'
import { db } from '@/db'
import { assets } from '@/db/schema'
import { ok, withErrorHandling } from '@/lib/server/api'
import { listUserDepositAddresses } from '@/lib/server/deposit-addresses'
import { requireVerifiedUser } from '@/lib/server/guard'

/**
 * Every deposit address issued to the signed-in user.
 *
 * Powers the deposit screen's asset list in one round trip, so it can show at a
 * glance which assets can be funded and which cannot.
 *
 * Deliberately weaker than the per-asset endpoint: `requireVerifiedUser` rather
 * than `requireKycVerified`, because listing which assets *have* an address is
 * not the same as handing someone a destination to send funds to. The addresses
 * themselves still only ever belong to the caller — the query is scoped by
 * user id, never by a parameter the client controls.
 *
 * `assets` carries no per-user data, so the catalogue rides along to save the
 * client a second request for symbols and names.
 */
export const GET = withErrorHandling(async () => {
  const guard = await requireVerifiedUser()
  if (!guard.ok) return guard.response

  const addresses = await listUserDepositAddresses(guard.user.id)

  const catalogue = await db
    .select({
      id: assets.id,
      symbol: assets.symbol,
      name: assets.name,
      color: assets.color,
      network: assets.network,
    })
    .from(assets)
    .orderBy(asc(assets.displayOrder))

  return ok({
    addresses,
    assets: catalogue,
    /** True when nothing has been issued yet — drives the empty state's wording. */
    awaitingAssignment: addresses.length === 0,
  })
})
