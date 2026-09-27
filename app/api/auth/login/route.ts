import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { fail, ok, parseBody, tooManyRequests, withErrorHandling } from '@/lib/server/api'
import { AuditAction, recordAudit, recordLoginAttempt } from '@/lib/server/audit'
import { decryptSecret, fakePasswordVerify, verifyPassword } from '@/lib/server/crypto'
import { publicUser } from '@/lib/server/guard'
import { RULES, checkRateLimit, resetRateLimit } from '@/lib/server/rate-limit'
import { createSession, getRequestContext } from '@/lib/server/session'
import { consumeRecoveryCode, verifyTotp } from '@/lib/server/totp'
import { loginSchema } from '@/lib/server/validation'

/** Consecutive failures before the account is temporarily locked. */
const MAX_FAILED_ATTEMPTS = 10
const LOCKOUT_MS = 15 * 60 * 1000

/** One message for every credential failure — see the note below. */
const INVALID_CREDENTIALS = 'Email or password is incorrect.'

export const POST = withErrorHandling(async (request: Request) => {
  const context = await getRequestContext()

  const parsed = await parseBody(request, loginSchema)
  if (!parsed.success) return parsed.response
  const { email, password, totpCode } = parsed.data

  /**
   * Rate limited on IP *and* on the target address.
   *
   * IP alone lets a botnet spread attempts against one account across many
   * addresses; email alone lets one host walk a list of accounts.
   */
  const ipKey = `login:ip:${context.ipAddress ?? 'unknown'}`
  const emailKey = `login:email:${email}`

  for (const key of [ipKey, emailKey]) {
    const limit = await checkRateLimit(key, RULES.login)
    if (!limit.allowed) {
      await recordLoginAttempt({
        emailAttempted: email,
        success: false,
        failureReason: 'rate_limited',
        context,
      })
      return tooManyRequests(
        'Too many sign-in attempts. Try again shortly.',
        limit.retryAfterSeconds,
      )
    }
  }

  // `emailSchema` lower-cases, and rows are stored lower-cased, so this hits
  // the unique b-tree index directly.
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)

  /**
   * Unknown address: still perform an Argon2 hash before replying.
   *
   * Without this, a missing account returns in ~1ms and a real one in ~50ms,
   * which is a reliable oracle for enumerating registered users.
   */
  if (!user) {
    await fakePasswordVerify()
    await recordLoginAttempt({
      emailAttempted: email,
      success: false,
      failureReason: 'unknown_user',
      context,
    })
    return fail('invalid_credentials', INVALID_CREDENTIALS, 401)
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await recordLoginAttempt({
      userId: user.id,
      emailAttempted: email,
      success: false,
      failureReason: 'locked',
      context,
    })
    const retryAfter = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000)
    return tooManyRequests(
      'This account is temporarily locked after repeated failed attempts.',
      retryAfter,
    )
  }

  const passwordValid = await verifyPassword(user.passwordHash, password)

  if (!passwordValid) {
    const failedCount = user.failedLoginCount + 1
    const shouldLock = failedCount >= MAX_FAILED_ATTEMPTS

    await db
      .update(users)
      .set({
        failedLoginCount: failedCount,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_MS) : user.lockedUntil,
      })
      .where(eq(users.id, user.id))

    await recordLoginAttempt({
      userId: user.id,
      emailAttempted: email,
      success: false,
      failureReason: 'bad_password',
      context,
    })
    return fail('invalid_credentials', INVALID_CREDENTIALS, 401)
  }

  /* ---------------- Second factor ---------------- */

  if (user.totpEnabledAt && user.totpSecret) {
    if (!totpCode) {
      // Password was right but we don't say so — just that a code is needed.
      return ok({ requiresTwoFactor: true, message: 'Enter your authentication code.' })
    }

    const twoFactorLimit = await checkRateLimit(`2fa:${user.id}`, RULES.twoFactor)
    if (!twoFactorLimit.allowed) {
      return tooManyRequests(
        'Too many authentication attempts. Try again shortly.',
        twoFactorLimit.retryAfterSeconds,
      )
    }

    const secret = decryptSecret(user.totpSecret)
    if (!secret) {
      // Key rotation gone wrong, or a tampered row. Never fail open on 2FA.
      console.error('[auth] could not decrypt TOTP secret for user', user.id)
      return fail(
        'two_factor_unavailable',
        'Two-factor authentication cannot be verified right now. Contact support.',
        500,
      )
    }

    const codeValid = verifyTotp(secret, totpCode, user.email)
    const recoveryUsed = codeValid ? false : await consumeRecoveryCode(user.id, totpCode)

    if (!codeValid && !recoveryUsed) {
      await recordLoginAttempt({
        userId: user.id,
        emailAttempted: email,
        success: false,
        failureReason: 'bad_totp',
        context,
      })
      return fail('invalid_two_factor', 'That code is not valid.', 401)
    }

    if (recoveryUsed) {
      await recordAudit({
        actorId: user.id,
        actorRole: user.role,
        action: AuditAction.RecoveryCodeUsed,
        targetType: 'user',
        targetId: user.id,
        context,
      })
    }
  }

  /* ---------------- Account state ---------------- */

  if (user.status !== 'active') {
    await recordLoginAttempt({
      userId: user.id,
      emailAttempted: email,
      success: false,
      failureReason: 'account_' + user.status,
      context,
    })
    return fail(
      'account_unavailable',
      'This account is not currently available. Contact support.',
      403,
    )
  }

  /* ---------------- Success ---------------- */

  await db
    .update(users)
    .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(users.id, user.id))

  await createSession(user.id, context)
  await resetRateLimit(emailKey)

  await recordLoginAttempt({ userId: user.id, emailAttempted: email, success: true, context })
  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: AuditAction.UserLoggedIn,
    targetType: 'user',
    targetId: user.id,
    context,
  })

  return ok({
    authenticated: true,
    user: publicUser(user),
    emailVerified: Boolean(user.emailVerifiedAt),
  })
})
