import { db } from '@/db'
import { users, verificationTokens } from '@/db/schema'
import { created, parseBody, tooManyRequests, withErrorHandling } from '@/lib/server/api'
import { AuditAction, recordAudit } from '@/lib/server/audit'
import { generateToken, hashPassword, hashToken } from '@/lib/server/crypto'
import { capabilities } from '@/lib/server/env'
import { sendVerificationEmail } from '@/lib/server/mailer'
import { RULES, checkRateLimit } from '@/lib/server/rate-limit'
import { getRequestContext } from '@/lib/server/session'
import { registerSchema } from '@/lib/server/validation'

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000

export const POST = withErrorHandling(async (request: Request) => {
  const context = await getRequestContext()

  const limit = await checkRateLimit(`register:${context.ipAddress ?? 'unknown'}`, RULES.register)
  if (!limit.allowed) {
    // State the actual wait. "Try again later" gives someone no way to tell a
    // few minutes from an hour, so they retry in a loop and burn the window
    // down further.
    const minutes = Math.ceil(limit.retryAfterSeconds / 60)
    return tooManyRequests(
      `Too many sign-ups from this network. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      limit.retryAfterSeconds,
    )
  }

  const parsed = await parseBody(request, registerSchema)
  if (!parsed.success) return parsed.response

  const { firstName, lastName, email, password, acceptedTerms } = parsed.data

  const passwordHash = await hashPassword(password)

  /**
   * Insert, relying on the unique index to settle the race.
   *
   * A check-then-insert would let two concurrent signups for the same address
   * both pass the check. `onConflictDoNothing` makes the database the single
   * arbiter — if no row comes back, the address was already taken.
   */
  const [user] = await db
    .insert(users)
    .values({
      firstName,
      lastName,
      email,
      passwordHash,
      acceptedTermsAt: acceptedTerms ? new Date() : null,
    })
    .onConflictDoNothing({ target: users.email })
    .returning()

  /**
   * Identical response whether or not the address was already registered.
   *
   * Returning "email already in use" turns this endpoint into an oracle for
   * checking who holds an account here — which, for a financial platform, is
   * exactly the list a phishing campaign wants. The existing account holder is
   * told by email instead.
   */
  if (!user) {
    return created({
      registered: true,
      emailDelivery: capabilities.email ? 'sent' : 'unavailable',
      message: capabilities.email
        ? 'Check your email for a link to confirm your address.'
        : 'Account request received. Email delivery is not configured on this deployment, so no confirmation link was sent.',
    })
  }

  const token = generateToken()
  await db.insert(verificationTokens).values({
    userId: user.id,
    purpose: 'email_verification',
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
  })

  const mail = await sendVerificationEmail(user.email, token)

  await recordAudit({
    actorId: user.id,
    actorRole: 'user',
    action: AuditAction.UserRegistered,
    targetType: 'user',
    targetId: user.id,
    metadata: { emailSent: mail.sent },
    context,
  })

  // No session is issued here: the address is confirmed before the account is usable.
  return created({
    registered: true,
    emailDelivery: mail.sent ? 'sent' : 'unavailable',
    message: mail.sent
      ? 'Check your email for a link to confirm your address.'
      : 'Account created. Email delivery is not configured on this deployment, so no confirmation link was sent — an administrator must verify this address manually.',
  })
})
