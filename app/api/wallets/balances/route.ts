import { and, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { linkedWallets } from '@/db/wallet-schema'
import { ok, withErrorHandling } from '@/lib/server/api'
import { readBalances } from '@/lib/server/chain/evm'
import { requireVerifiedUser } from '@/lib/server/guard'
import { getMarketQuotes } from '@/lib/server/market-service'

/**
 * Balances for every linked wallet, read live from chain.
 *
 * The contrast with the custodial endpoint is the whole point: no ledger is
 * consulted, and no stored number is returned. What the chain says is what the
 * user sees.
 *
 * Amounts stay decimal strings end to end. The USD figure is computed for
 * display only and is explicitly derived — it is a convenience on top of the
 * authoritative on-chain amount, not a second source of truth.
 */
export const GET = withErrorHandling(async () => {
  const guard = await requireVerifiedUser()
  if (!guard.ok) return guard.response

  const wallets = await db
    .select()
    .from(linkedWallets)
    .where(
      and(
        eq(linkedWallets.userId, guard.user.id),
        eq(linkedWallets.status, 'active'),
        isNull(linkedWallets.revokedAt),
      ),
    )

  if (wallets.length === 0) {
    // A genuinely empty state, not a failure: no wallets linked yet.
    return ok({
      wallets: [],
      totalUsd: null,
      failures: [],
      custodial: false,
      message: 'No wallets linked yet.',
    })
  }

  const [{ balances, failures }, market] = await Promise.all([
    readBalances(wallets.map((w) => ({ chain: w.chain, address: w.address }))),
    getMarketQuotes(),
  ])

  const priceByAsset = new Map(market.quotes.map((quote) => [quote.assetId, quote.price]))

  const enriched = balances.map((balance) => {
    const price = priceByAsset.get(balance.assetId)
    const wallet = wallets.find(
      (w) => w.chain === balance.chain && w.address === balance.address,
    )

    return {
      walletId: wallet?.id ?? null,
      label: wallet?.label ?? null,
      chain: balance.chain,
      address: balance.address,
      symbol: balance.symbol,
      amount: balance.amount,
      raw: balance.raw,
      blockNumber: balance.blockNumber,
      readAt: balance.readAt,
      // Null, not zero, when the asset is unpriced. Unknown is not free.
      usdValue: price === undefined ? null : Number(balance.amount) * price,
    }
  })

  if (balances.length > 0) {
    await db
      .update(linkedWallets)
      .set({ lastSyncedAt: new Date() })
      .where(
        inArray(
          linkedWallets.id,
          enriched.map((e) => e.walletId).filter((id): id is string => Boolean(id)),
        ),
      )
  }

  /**
   * Total is null when any wallet failed to read.
   *
   * A total that silently omits an unreadable wallet understates the holding
   * and looks authoritative doing it. Better to withhold the figure and show
   * which wallet could not be reached.
   */
  const totalUsd =
    failures.length > 0 || enriched.some((e) => e.usdValue === null)
      ? null
      : enriched.reduce((sum, e) => sum + (e.usdValue ?? 0), 0)

  return ok({
    wallets: enriched,
    totalUsd,
    failures,
    custodial: false,
    pricesStale: market.quotes.some((quote) => quote.stale),
  })
})
