/**
 * Market data service.
 *
 * Swap point for a real provider: set NEXT_PUBLIC_MARKET_API_URL (or
 * NEXT_PUBLIC_API_BASE_URL) and implement the `live` branch of each call. The
 * response shape must satisfy `MarketQuote` / `Candle` from `lib/types.ts`.
 */

import { platform } from '../config'
import { assets, generateCandles, getQuote, marketQuotes } from '../mock-data'
import type { ApiResult, Asset, Candle, MarketQuote, Timeframe } from '../types'
import { request, withFallback } from './client'

export async function listAssets(): Promise<ApiResult<Asset[]>> {
  return withFallback(
    () => request<Asset[]>('/assets'),
    () => assets,
    120,
  )
}

/** Wire format of GET /api/markets/quotes. */
interface MarketPayload {
  quotes: Array<{
    assetId: string
    symbol: string
    name: string
    price: number
    change24h: number | null
    changePercent24h: number | null
    high24h: number | null
    low24h: number | null
    volume24h: number | null
    marketCap: number | null
    sparkline: number[] | null
    fetchedAt: string
    stale: boolean
  }>
  live: boolean
  message?: string
}

export async function listQuotes(): Promise<ApiResult<MarketQuote[]>> {
  return withFallback(
    async () => {
      const payload = await request<MarketPayload>('/markets/quotes')

      // Nulls become 0 only for display-optional fields. `price` is required
      // and the server omits any asset it could not price, so no row here
      // carries an invented number.
      return payload.quotes.map<MarketQuote>((quote) => ({
        assetId: quote.assetId,
        symbol: quote.symbol,
        name: quote.name,
        price: quote.price,
        change24h: quote.change24h ?? 0,
        changePercent24h: quote.changePercent24h ?? 0,
        high24h: quote.high24h ?? quote.price,
        low24h: quote.low24h ?? quote.price,
        volume24h: quote.volume24h ?? 0,
        marketCap: quote.marketCap ?? 0,
        sparkline: quote.sparkline ?? [],
        updatedAt: quote.fetchedAt,
      }))
    },
    () => marketQuotes,
  )
}

export async function fetchQuote(symbol: string): Promise<ApiResult<MarketQuote | undefined>> {
  return withFallback(
    () => request<MarketQuote>(`/markets/quotes/${symbol}`),
    () => getQuote(symbol),
    150,
  )
}

export async function fetchCandles(
  symbol: string,
  timeframe: Timeframe,
): Promise<ApiResult<Candle[]>> {
  return withFallback(
    () => request<Candle[]>(`/markets/candles/${symbol}`, { query: { timeframe } }),
    () => generateCandles(symbol, timeframe),
    180,
  )
}

/**
 * Live-ish quote updates.
 *
 * With a real provider configured this polls the API, which serves its own
 * Postgres-backed cache — so the upstream quota is spent once per refresh
 * window regardless of how many browsers are watching.
 *
 * Without a provider it nudges the mock prices instead, which is clearly
 * simulated movement and never presented as market data.
 */
export function subscribeToQuotes(
  onUpdate: (quotes: MarketQuote[]) => void,
  intervalMs = 5000,
): () => void {
  if (platform.liveMarketData) {
    // Slower than the mock: real prices are cached server-side for ~60s, so
    // polling faster would only add load without adding information.
    const pollMs = Math.max(intervalMs, 30_000)
    const timer = setInterval(() => {
      listQuotes()
        .then(({ data }) => onUpdate(data))
        .catch((error) => console.warn('[markets] poll failed:', error))
    }, pollMs)
    return () => clearInterval(timer)
  }

  let current = marketQuotes.map((q) => ({ ...q }))

  const timer = setInterval(() => {
    current = current.map((quote) => {
      // ±0.15% wobble, stablecoins held effectively flat.
      const magnitude = quote.symbol === 'USDT' ? 0.0002 : 0.0015
      const drift = (Math.random() - 0.5) * 2 * magnitude
      const price = Number((quote.price * (1 + drift)).toFixed(quote.price < 10 ? 4 : 2))
      const changePercent24h = Number((quote.changePercent24h + drift * 100).toFixed(2))
      return {
        ...quote,
        price,
        changePercent24h,
        change24h: (price * changePercent24h) / 100,
        sparkline: [...quote.sparkline.slice(1), price],
        updatedAt: new Date().toISOString(),
      }
    })
    onUpdate(current)
  }, intervalMs)

  return () => clearInterval(timer)
}
