import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { rateLimits } from '@/db/schema'

/**
 * Fixed-window rate limiter backed by Postgres.
 *
 * Deliberately not an in-process Map: serverless instances don't share memory,
 * so an in-process counter gives an attacker a fresh allowance with every cold
 * start. The whole increment-and-check runs in one atomic statement, so two
 * concurrent requests cannot both read the same count and both be allowed.
 */

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

export interface RateLimitRule {
  /** Requests permitted per window. */
  limit: number
  /** Window length in seconds. */
  windowSeconds: number
}

/**
 * Production limits.
 *
 * Sized against shared IPs, not single users. Mobile carrier NAT, offices,
 * universities and cafés put many legitimate people behind one address — a
 * limit tuned for "one person shouldn't do this often" locks out everyone in
 * the building when several sign up the same morning.
 *
 * So the per-IP allowances are generous enough for a shared address, and the
 * tight limits go on the per-account keys instead, where a single identity
 * genuinely is one person. `login` is rate limited on IP *and* on the target
 * email, which is what actually stops credential stuffing.
 *
 * These are a floor, not a complete defence. Add CAPTCHA or proof-of-work on
 * registration before launch — a determined attacker rotates IPs, and no
 * counter keyed on address alone survives that.
 */
const PRODUCTION_RULES = {
  login: { limit: 10, windowSeconds: 300 },
  register: { limit: 15, windowSeconds: 3600 },
  passwordReset: { limit: 10, windowSeconds: 3600 },
  emailVerification: { limit: 15, windowSeconds: 3600 },
  twoFactor: { limit: 5, windowSeconds: 300 },
  kycSubmit: { limit: 5, windowSeconds: 86400 },
  readApi: { limit: 120, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>

/**
 * Development limits.
 *
 * Deliberately loose. A developer re-running a signup flow is not an attack,
 * and a limiter that locks you out for an hour after three attempts just gets
 * disabled wholesale — which is how it ends up disabled in production too.
 * Same code path, same keys, same expiry logic; only the numbers differ, so
 * the limiter is still genuinely exercised locally.
 */
const DEVELOPMENT_RULES = {
  login: { limit: 100, windowSeconds: 300 },
  register: { limit: 100, windowSeconds: 300 },
  passwordReset: { limit: 100, windowSeconds: 300 },
  emailVerification: { limit: 100, windowSeconds: 300 },
  twoFactor: { limit: 50, windowSeconds: 300 },
  kycSubmit: { limit: 50, windowSeconds: 300 },
  readApi: { limit: 1000, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>

export const RULES =
  process.env.NODE_ENV === 'production' ? PRODUCTION_RULES : DEVELOPMENT_RULES

export async function checkRateLimit(
  identifier: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  const key = identifier.slice(0, 160)
  const windowMs = rule.windowSeconds * 1000

  // Upsert that resets the counter when the stored window has elapsed.
  // Doing it in SQL keeps read-modify-write atomic under concurrency.
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, windowStart: new Date() })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE
          WHEN ${rateLimits.windowStart} < now() - (${rule.windowSeconds} * interval '1 second')
          THEN 1
          ELSE ${rateLimits.count} + 1
        END`,
        windowStart: sql`CASE
          WHEN ${rateLimits.windowStart} < now() - (${rule.windowSeconds} * interval '1 second')
          THEN now()
          ELSE ${rateLimits.windowStart}
        END`,
      },
    })
    .returning({ count: rateLimits.count, windowStart: rateLimits.windowStart })

  const count = row?.count ?? 1
  const windowStart = row?.windowStart ?? new Date()
  const elapsed = Date.now() - windowStart.getTime()
  const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - elapsed) / 1000))

  return {
    allowed: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSeconds,
  }
}

/** Called after a successful login so one bad guess doesn't linger. */
export async function resetRateLimit(identifier: string) {
  await db.delete(rateLimits).where(sql`${rateLimits.key} = ${identifier.slice(0, 160)}`)
}

/** Cron housekeeping: drop windows that can no longer block anything. */
export async function purgeStaleRateLimits() {
  const deleted = await db
    .delete(rateLimits)
    .where(sql`${rateLimits.windowStart} < now() - interval '2 days'`)
    .returning({ key: rateLimits.key })
  return deleted.length
}
