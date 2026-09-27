import 'server-only'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { assets, marketQuotes } from '@/db/schema'
import {
  fetchProviderQuotes,
  isMarketProviderConfigured,
  MarketProviderError,
} from './market-provider'

/** Refetch upstream when the cached row is older than this. */
const CACHE_TTL_MS = 60_000
/** Beyond this, data is reported as stale rather than served as current. */
const STALE_AFTER_MS = 10 * 60_000

export interface ServedQuote {
  assetId: string
  symbol: string
  name: string
  color: string
  network: string | null
  price: number
  change24h: number | null
  changePercent24h: number | null
  high24h: number | null
  low24h: number | null
  volume24h: number | null
  marketCap: number | null
  sparkline: number[] | null
  fetchedAt: string
  /** True when the cached row is older than STALE_AFTER_MS. */
  stale: boolean
}

export interface MarketPayload {
  quotes: ServedQuote[]
  provider: string | null
  /** False when no provider key is configured — the UI must say so. */
  live: boolean
  message?: string
}

/**
 * Serves market quotes, refreshing from the provider when the cache is cold.
 *
 * If the upstream call fails, the last good cached rows are served and flagged
 * stale rather than erroring the whole page — but they are never presented as
 * current. Staleness travels with the data.
 */
export async function getMarketQuotes(): Promise<MarketPayload> {
  const assetRows = await db.select().from(assets).orderBy(asc(assets.displayOrder))

  if (assetRows.length === 0) {
    return {
      quotes: [],
      provider: null,
      live: false,
      message: 'No assets are configured. Run the database seed.',
    }
  }

  if (!isMarketProviderConfigured()) {
    return {
      quotes: [],
      provider: null,
      live: false,
      message:
        'No market data provider is configured. Set MARKET_API_KEY to serve live prices.',
    }
  }

  const cached = await db.select().from(marketQuotes)
  const cacheByAsset = new Map(cached.map((row) => [row.assetId, row]))
  const now = Date.now()

  const needsRefresh =
    cached.length < assetRows.length ||
    cached.some((row) => now - row.fetchedAt.getTime() > CACHE_TTL_MS)

  let refreshError: string | undefined

  if (needsRefresh) {
    try {
      const providerIds = assetRows
        .map((asset) => asset.providerId)
        .filter((id): id is string => Boolean(id))

      const fresh = await fetchProviderQuotes(providerIds)
      const byProviderId = new Map(fresh.map((quote) => [quote.providerId, quote]))
      const fetchedAt = new Date()

      for (const asset of assetRows) {
        const quote = asset.providerId ? byProviderId.get(asset.providerId) : undefined
        if (!quote) continue

        const values = {
          assetId: asset.id,
          // numeric columns take strings — passing a float here would round.
          price: String(quote.price),
          change24h: quote.change24h === null ? null : String(quote.change24h),
          changePercent24h:
            quote.changePercent24h === null ? null : String(quote.changePercent24h),
          high24h: quote.high24h === null ? null : String(quote.high24h),
          low24h: quote.low24h === null ? null : String(quote.low24h),
          volume24h: quote.volume24h === null ? null : String(quote.volume24h),
          marketCap: quote.marketCap === null ? null : String(quote.marketCap),
          sparkline: quote.sparkline,
          provider: 'coingecko',
          fetchedAt,
        }

        const [updated] = await db
          .insert(marketQuotes)
          .values(values)
          .onConflictDoUpdate({ target: marketQuotes.assetId, set: values })
          .returning()

        cacheByAsset.set(asset.id, updated)
      }
    } catch (error) {
      // Serve what we have, marked stale. An outage upstream should degrade
      // the page, not break it — but it must never look like fresh data.
      refreshError =
        error instanceof MarketProviderError
          ? `Market data provider unavailable (${error.status ?? 'network error'}).`
          : 'Market data provider unavailable.'
      console.error('[market] refresh failed:', error)
    }
  }

  const quotes: ServedQuote[] = []
  for (const asset of assetRows) {
    const row = cacheByAsset.get(asset.id)
    if (!row) continue

    quotes.push({
      assetId: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      color: asset.color,
      network: asset.network,
      price: Number(row.price),
      change24h: row.change24h === null ? null : Number(row.change24h),
      changePercent24h:
        row.changePercent24h === null ? null : Number(row.changePercent24h),
      high24h: row.high24h === null ? null : Number(row.high24h),
      low24h: row.low24h === null ? null : Number(row.low24h),
      volume24h: row.volume24h === null ? null : Number(row.volume24h),
      marketCap: row.marketCap === null ? null : Number(row.marketCap),
      sparkline: row.sparkline ?? null,
      fetchedAt: row.fetchedAt.toISOString(),
      stale: Date.now() - row.fetchedAt.getTime() > STALE_AFTER_MS,
    })
  }

  return {
    quotes,
    provider: 'coingecko',
    live: quotes.length > 0 && !quotes.every((quote) => quote.stale),
    message: refreshError,
  }
}

export async function getQuoteBySymbol(symbol: string): Promise<ServedQuote | null> {
  const payload = await getMarketQuotes()
  return (
    payload.quotes.find((quote) => quote.symbol.toLowerCase() === symbol.toLowerCase()) ??
    null
  )
}

export async function listTradableAssets() {
  return db.select().from(assets).where(eq(assets.tradable, true)).orderBy(asc(assets.displayOrder))
}
