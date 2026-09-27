import { and, eq, gt, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { sessions, users, verificationTokens } from '@/db/schema'
import { fail, ok, parseBody, tooManyRequests, withErrorHandling } from '@/lib/server/api'
import { AuditAction, recordAudit } from '@/lib/server/audit'
import { hashPassword, hashToken } from '@/lib/server/crypto'
import { sendSecurityAlert } from '@/lib/server/mailer'
import { RULES, checkRateLimit } from '@/lib/server/rate-limit'
import { getRequestContext } from '@/lib/server/session'
import { resetPasswordSchema } from '@/lib/server/validation'

export const POST = withErrorHandling(async (request: Request) => {
  const context = await getRequestContext()

  const limit = await checkRateLimit(
    `reset-confirm:${context.ipAddress ?? 'unknown'}`,
    RULES.passwordReset,
  )
  if (!limit.allowed) {
    return tooManyRequests('Too many attempts. Try again later.', limit.retryAfterSeconds)
  }

  const parsed = await parseBody(request, resetPasswordSchema)
  if (!parsed.success) return parsed.response

  const tokenHash = hashToken(parsed.data.token)
  const passwordHash = await hashPassword(parsed.data.password)
  const now = new Date()

  /**
   * One transaction: consume the token, set the password, kill every session.
   *
   * Revoking sessions is the part that matters most. A password reset is how
   * someone recovers from a compromise, so any session the attacker still holds
   * has to die here — otherwise the reset changes the lock while the intruder
   * is still inside.
   */
  const result = await db.transaction(async (tx) => {
    const [token] = await tx
      .update(verificationTokens)
      .set({ consumedAt: now })
      .where(
        and(
          eq(verificationTokens.tokenHash, tokenHash),
          eq(verificationTokens.purpose, 'password_reset'),
          isNull(verificationTokens.consumedAt),
          gt(verificationTokens.expiresAt, now),
        ),
      )
      .returning()

    if (!token) return null

    const [user] = await tx
      .update(users)
      .set({
        passwordHash,
        passwordChangedAt: now,
        updatedAt: now,
        failedLoginCount: 0,
        lockedUntil: null,
        // Completing a reset proves control of the mailbox, so an unverified
        // address becomes verified. An existing timestamp is left untouched.
        emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, ${now})`,
      })
      .where(eq(users.id, token.userId))
      .returning()

    await tx
      .update(sessions)
      .set({ revokedAt: now })
      .where(and(eq(sessions.userId, token.userId), isNull(sessions.revokedAt)))

    return user
  })

  if (!result) {
    return fail(
      'invalid_token',
      'That reset link is invalid or has expired. Request a new one.',
      400,
    )
  }

  await sendSecurityAlert(result.email, 'Your password was changed.')

  await recordAudit({
    actorId: result.id,
    actorRole: result.role,
    action: AuditAction.PasswordResetCompleted,
    targetType: 'user',
    targetId: result.id,
    context,
  })

  return ok({
    reset: true,
    message: 'Your password has been changed. Sign in with your new password.',
  })
})
