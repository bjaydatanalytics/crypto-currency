import 'server-only'
import { env } from './env'

/**
 * Market data provider.
 *
 * Fetched server-side for three reasons: the API key never reaches the browser,
 * one upstream request serves every visitor instead of one per browser, and the
 * result can be cached in Postgres so the page still renders when the provider
 * is briefly down.
 *
 * `fetchedAt` is returned with every quote and carried through to the client so
 * the UI can say how old the data is. Stale prices presented as live is exactly
 * the failure mode that gets people hurt.
 */

export interface ProviderQuote {
  providerId: string
  price: number
  change24h: number | null
  changePercent24h: number | null
  high24h: number | null
  low24h: number | null
  volume24h: number | null
  marketCap: number | null
  sparkline: number[] | null
}

export class MarketProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'MarketProviderError'
  }
}

export const isMarketProviderConfigured = () => Boolean(env.MARKET_API_KEY)

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3'
const COINGECKO_PRO_BASE = 'https://pro-api.coingecko.com/api/v3'

/**
 * Fetches quotes for the given provider ids.
 *
 * One request for all assets rather than one per asset: providers rate-limit by
 * request count, and N separate calls would exhaust a free tier in minutes.
 */
async function fetchCoinGecko(providerIds: string[]): Promise<ProviderQuote[]> {
  if (providerIds.length === 0) return []

  const key = env.MARKET_API_KEY
  // Demo keys work against the public host; paid keys require the pro host.
  const isPro = Boolean(key && !key.startsWith('CG-'))
  const base = isPro ? COINGECKO_PRO_BASE : COINGECKO_BASE

  const url = new URL(`${base}/coins/markets`)
  url.searchParams.set('vs_currency', 'usd')
  url.searchParams.set('ids', providerIds.join(','))
  url.searchParams.set('sparkline', 'true')
  url.searchParams.set('price_change_percentage', '24h')
  url.searchParams.set('precision', 'full')

  const headers: Record<string, string> = { accept: 'application/json' }
  if (key) headers[isPro ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key'] = key

  const response = await fetch(url, {
    headers,
    // Cached in Postgres instead; Next's fetch cache would hide staleness.
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    throw new MarketProviderError(
      `CoinGecko responded ${response.status}`,
      response.status,
    )
  }

  const payload = (await response.json()) as Array<{
    id: string
    current_price: number | null
    price_change_24h: number | null
    price_change_percentage_24h: number | null
    high_24h: number | null
    low_24h: number | null
    total_volume: number | null
    market_cap: number | null
    sparkline_in_7d?: { price: number[] }
  }>

  return payload
    .filter((row) => typeof row.current_price === 'number')
    .map((row) => ({
      providerId: row.id,
      price: row.current_price as number,
      change24h: row.price_change_24h ?? null,
      changePercent24h: row.price_change_percentage_24h ?? null,
      high24h: row.high_24h ?? null,
      low24h: row.low_24h ?? null,
      volume24h: row.total_volume ?? null,
      marketCap: row.market_cap ?? null,
      // 7d hourly series is ~168 points; thin it to 28 for the sparkline.
      sparkline: thin(row.sparkline_in_7d?.price ?? null, 28),
    }))
}

function thin(series: number[] | null, target: number): number[] | null {
  if (!series || series.length === 0) return null
  if (series.length <= target) return series

  const step = series.length / target
  const out: number[] = []
  for (let i = 0; i < target; i++) out.push(series[Math.floor(i * step)])
  // Always keep the most recent point so the series ends at the latest price.
  out[out.length - 1] = series[series.length - 1]
  return out
}

export function fetchProviderQuotes(providerIds: string[]): Promise<ProviderQuote[]> {
  switch (env.MARKET_PROVIDER) {
    case 'coingecko':
      return fetchCoinGecko(providerIds)
    default:
      throw new MarketProviderError(`Unsupported provider: ${env.MARKET_PROVIDER}`)
  }
}
