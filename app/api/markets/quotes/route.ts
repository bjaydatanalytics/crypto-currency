import { ok, tooManyRequests, withErrorHandling } from '@/lib/server/api'
import { getMarketQuotes } from '@/lib/server/market-service'
import { RULES, checkRateLimit } from '@/lib/server/rate-limit'
import { getRequestContext } from '@/lib/server/session'

/**
 * Public market data.
 *
 * Unauthenticated by design — prices are shown on the marketing site — but rate
 * limited so it can't be used as a free proxy onto our metered provider quota.
 */
export const GET = withErrorHandling(async () => {
  const context = await getRequestContext()

  const limit = await checkRateLimit(
    `markets:${context.ipAddress ?? 'unknown'}`,
    RULES.readApi,
  )
  if (!limit.allowed) {
    return tooManyRequests('Too many requests.', limit.retryAfterSeconds)
  }

  const payload = await getMarketQuotes()

  return ok(payload, {
    headers: {
      // Short shared cache; the service layer holds the real cache in Postgres.
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
    },
  })
})
