import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { users, verificationTokens } from '@/db/schema'
import { fail, ok, parseBody, withErrorHandling } from '@/lib/server/api'
import { AuditAction, recordAudit } from '@/lib/server/audit'
import { generateToken, hashToken } from '@/lib/server/crypto'
import { sendVerificationEmail } from '@/lib/server/mailer'
import { checkRateLimit, RULES } from '@/lib/server/rate-limit'
import { getRequestContext } from '@/lib/server/session'
import { resendVerificationSchema } from '@/lib/server/validation'

/** Matches registration, so a resent link behaves identically to the first. */
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000

/**
 * POST — reissue an email verification link.
 *
 * Without this, anyone whose first email was lost, filtered or expired has no
 * route back into their own account.
 *
 * **The response is identical whether or not the address exists**, and whether
 * or not it was already verified. Anything else turns this endpoint into a
 * membership oracle: an attacker submits addresses and reads the replies to
 * learn who banks here. Rate limited per address for the same reason, and
 * because sending mail on demand is otherwise a way to use this server to
 * spam someone else's inbox.
 *
 * Outstanding tokens are invalidated first, so a link that leaked somewhere —
 * a shared screen, a forwarded email — stops working the moment a new one is
 * requested.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const parsed = await parseBody(request, resendVerificationSchema)
  if (!parsed.success) return parsed.response

  const { email } = parsed.data
  const context = await getRequestContext()

  const limit = await checkRateLimit(`resend-verification:${email}`, RULES.emailVerification)
  if (!limit.allowed) {
    return fail(
      'rate_limited',
      `Too many requests. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`,
      429,
    )
  }

  // Deliberately uniform, whatever happens below.
  const uniformResponse = ok({
    sent: true,
    message:
      'If that address belongs to an unverified account, a new verification link is on its way.',
  })

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)

  if (!user || user.emailVerifiedAt) return uniformResponse

  // Burn any link still outstanding for this account.
  await db
    .update(verificationTokens)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(verificationTokens.userId, user.id),
        eq(verificationTokens.purpose, 'email_verification'),
        isNull(verificationTokens.consumedAt),
      ),
    )

  const token = generateToken()
  await db.insert(verificationTokens).values({
    userId: user.id,
    purpose: 'email_verification',
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
  })

  await sendVerificationEmail(user.email, token)

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: AuditAction.EmailVerified,
    targetType: 'user',
    targetId: user.id,
    metadata: { resent: true },
    context,
  })

  return uniformResponse
})
