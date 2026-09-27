import { and, eq, gt, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { users, verificationTokens } from '@/db/schema'
import { fail, ok, parseBody, tooManyRequests, withErrorHandling } from '@/lib/server/api'
import { AuditAction, recordAudit } from '@/lib/server/audit'
import { hashToken } from '@/lib/server/crypto'
import { RULES, checkRateLimit } from '@/lib/server/rate-limit'
import { getRequestContext } from '@/lib/server/session'
import { verifyEmailSchema } from '@/lib/server/validation'

export const POST = withErrorHandling(async (request: Request) => {
  const context = await getRequestContext()

  const limit = await checkRateLimit(
    `verify:${context.ipAddress ?? 'unknown'}`,
    RULES.emailVerification,
  )
  if (!limit.allowed) {
    return tooManyRequests('Too many attempts. Try again shortly.', limit.retryAfterSeconds)
  }

  const parsed = await parseBody(request, verifyEmailSchema)
  if (!parsed.success) return parsed.response

  const tokenHash = hashToken(parsed.data.token)

  /**
   * Consume and verify atomically.
   *
   * The token is marked consumed inside the same transaction that flips the
   * user to verified, so a token replayed concurrently cannot be redeemed
   * twice.
   */
  const result = await db.transaction(async (tx) => {
    const [token] = await tx
      .update(verificationTokens)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(verificationTokens.tokenHash, tokenHash),
          eq(verificationTokens.purpose, 'email_verification'),
          isNull(verificationTokens.consumedAt),
          gt(verificationTokens.expiresAt, new Date()),
        ),
      )
      .returning()

    if (!token) return null

    const [user] = await tx
      .update(users)
      .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, token.userId))
      .returning()

    return user
  })

  if (!result) {
    return fail(
      'invalid_token',
      'That confirmation link is invalid or has expired. Request a new one.',
      400,
    )
  }

  await recordAudit({
    actorId: result.id,
    actorRole: result.role,
    action: AuditAction.EmailVerified,
    targetType: 'user',
    targetId: result.id,
    context,
  })

  return ok({ verified: true, message: 'Your email address has been confirmed.' })
})
