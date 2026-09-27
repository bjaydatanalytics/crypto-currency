import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users, verificationTokens } from '@/db/schema'
import { ok, parseBody, tooManyRequests, withErrorHandling } from '@/lib/server/api'
import { AuditAction, recordAudit } from '@/lib/server/audit'
import { generateToken, hashToken } from '@/lib/server/crypto'
import { capabilities } from '@/lib/server/env'
import { sendPasswordResetEmail } from '@/lib/server/mailer'
import { RULES, checkRateLimit } from '@/lib/server/rate-limit'
import { getRequestContext } from '@/lib/server/session'
import { forgotPasswordSchema } from '@/lib/server/validation'

const RESET_TTL_MS = 60 * 60 * 1000 // 1 hour

export const POST = withErrorHandling(async (request: Request) => {
  const context = await getRequestContext()

  const parsed = await parseBody(request, forgotPasswordSchema)
  if (!parsed.success) return parsed.response
  const { email } = parsed.data

  for (const key of [
    `reset:ip:${context.ipAddress ?? 'unknown'}`,
    `reset:email:${email}`,
  ]) {
    const limit = await checkRateLimit(key, RULES.passwordReset)
    if (!limit.allowed) {
      return tooManyRequests(
        'Too many reset requests. Try again later.',
        limit.retryAfterSeconds,
      )
    }
  }

  /**
   * The response below is identical whether or not the address is registered.
   *
   * Confirming which addresses have accounts would let anyone enumerate the
   * customer list of a financial platform. The work still happens when the user
   * exists; the caller simply cannot tell.
   */
  const genericResponse = ok({
    requested: true,
    emailDelivery: capabilities.email ? 'sent' : 'unavailable',
    message: capabilities.email
      ? 'If an account exists for that address, a reset link has been sent.'
      : 'Request received. Email delivery is not configured on this deployment, so no link was sent.',
  })

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)

  if (!user || user.status !== 'active') return genericResponse

  const token = generateToken()
  await db.insert(verificationTokens).values({
    userId: user.id,
    purpose: 'password_reset',
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
  })

  await sendPasswordResetEmail(user.email, token)

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: AuditAction.PasswordResetRequested,
    targetType: 'user',
    targetId: user.id,
    context,
  })

  return genericResponse
})
