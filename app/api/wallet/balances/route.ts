import { asc } from 'drizzle-orm'
import { db } from '@/db'
import { assets } from '@/db/schema'
import { ok, withErrorHandling } from '@/lib/server/api'
import { listUserDepositAddresses } from '@/lib/server/deposit-addresses'
import { requireVerifiedUser } from '@/lib/server/guard'
import { getUserBalances } from '@/lib/server/ledger'
import { getMarketQuotes } from '@/lib/server/market-service'

/**
 * Wallet balances, computed from the ledger.
 *
 * Balances come from summing immutable ledger entries — there is no stored
 * balance column anywhere that could drift or be edited. A user with no
 * deposits correctly returns zero for every asset, which is the truth, not an
 * empty state standing in for missing data.
 */
export const GET = withErrorHandling(async () => {
  const guard = await requireVerifiedUser()
  if (!guard.ok) return guard.response

  const [balances, assetRows, market, depositAddresses] = await Promise.all([
    getUserBalances(guard.user.id),
    db.select().from(assets).orderBy(asc(assets.displayOrder)),
    getMarketQuotes(),
    listUserDepositAddresses(guard.user.id),
  ])

  // Which assets this user can actually fund. An asset with no assigned
  // address is one they cannot deposit, and the wallet screen has to say so
  // rather than offer a deposit button that leads nowhere.
  const depositableAssets = new Set(depositAddresses.map((entry) => entry.assetId))

  const balanceByAsset = new Map(balances.map((entry) => [entry.assetId, entry]))
  const priceByAsset = new Map(market.quotes.map((quote) => [quote.assetId, quote.price]))

  const wallets = assetRows.map((asset) => {
    const balance = balanceByAsset.get(asset.id)
    const available = balance?.available ?? '0'
    const locked = balance?.locked ?? '0'
    const price = priceByAsset.get(asset.id)

    // Total is computed in JS only for *display*. The authoritative amounts
    // stay as decimal strings; nothing here feeds back into the ledger.
    const totalUnits = Number(available) + Number(locked)

    return {
      assetId: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      color: asset.color,
      network: asset.network,
      available,
      locked,
      // Null rather than 0 when unpriced — an unknown value is not zero.
      usdValue: price === undefined ? null : totalUnits * price,
      /** False means this user has no address for the asset, so cannot deposit. */
      depositable: depositableAssets.has(asset.id),
    }
  })

  return ok({
    wallets,
    /**
     * True once at least one asset has a receiving address assigned to this
     * user. False means deposits are genuinely unavailable to them — not that
     * their balance happens to be zero.
     */
    custodyEnabled: depositAddresses.length > 0,
    pricesStale: market.quotes.some((quote) => quote.stale),
  })
})
