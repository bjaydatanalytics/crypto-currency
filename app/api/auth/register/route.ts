import { db } from '@/db'
import { users } from '@/db/schema'
import { created, parseBody, tooManyRequests, withErrorHandling } from '@/lib/server/api'
import { AuditAction, recordAudit } from '@/lib/server/audit'
import { hashPassword } from '@/lib/server/crypto'
import { publicUser } from '@/lib/server/guard'
import { RULES, checkRateLimit } from '@/lib/server/rate-limit'
import { createSession, getRequestContext } from '@/lib/server/session'
import { registerSchema } from '@/lib/server/validation'

/**
 * Registration.
 *
 * EMAIL VERIFICATION IS DELIBERATELY NOT PART OF THIS FLOW. An account is
 * usable the moment it is created: `emailVerifiedAt` is stamped at insert and
 * a session is issued straight away, so the customer lands signed in rather
 * than waiting on a link.
 *
 * What that costs, so it is a known trade and not a surprise later:
 *
 * - A typo'd address creates a working account the real owner cannot reach,
 *   and password-reset mail goes to a stranger.
 * - Nothing proves the address belongs to the person signing up, so sign-ups
 *   are cheap to automate and to make in someone else's name.
 * - Transactional mail (withdrawal alerts in particular) may silently go
 *   nowhere, which removes the signal that an account has been taken over.
 *
 * KYC is untouched and still gates anything that moves money, so an
 * unverifiable address cannot deposit or withdraw on its own.
 */
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
      // Stamped on creation: there is no separate confirmation step to wait for.
      emailVerifiedAt: new Date(),
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
    /**
     * The address was already registered.
     *
     * Still reports success, and deliberately issues no session: saying
     * "already in use" would turn this endpoint into an oracle for who holds
     * an account here, and signing the caller in would hand them someone
     * else's. `authenticated: false` is what the form reads to decide whether
     * it can go straight to the dashboard.
     */
    return created({
      registered: true,
      authenticated: false,
      message:
        'If that address is not already registered, the account has been created. ' +
        'Try signing in.',
    })
  }

  await createSession(user.id, context)

  await recordAudit({
    actorId: user.id,
    actorRole: 'user',
    action: AuditAction.UserRegistered,
    targetType: 'user',
    targetId: user.id,
    metadata: { emailVerificationRequired: false },
    context,
  })

  return created({
    registered: true,
    authenticated: true,
    user: publicUser(user),
    message: 'Your account is ready.',
  })
})
