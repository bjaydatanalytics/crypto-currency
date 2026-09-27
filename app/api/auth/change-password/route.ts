import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { fail, ok, parseBody, withErrorHandling } from '@/lib/server/api'
import { AuditAction, recordAudit } from '@/lib/server/audit'
import { hashPassword, verifyPassword } from '@/lib/server/crypto'
import { requireUser } from '@/lib/server/guard'
import { sendSecurityAlert } from '@/lib/server/mailer'
import { checkRateLimit, RULES } from '@/lib/server/rate-limit'
import { getRequestContext, revokeOtherSessions } from '@/lib/server/session'
import { changePasswordSchema } from '@/lib/server/validation'

/**
 * POST — change your own password.
 *
 * Four things happen in a deliberate order:
 *
 * 1. **The current password is re-verified.** Being signed in is not proof of
 *    identity here — a hijacked session or an unlocked laptop is exactly the
 *    situation this step exists to stop.
 * 2. **The new hash is written.**
 * 3. **Every other session is revoked.** If someone else was in the account,
 *    changing the password has to eject them; leaving their session alive makes
 *    the change cosmetic.
 * 4. **The owner is emailed.** A password change they did not make is the
 *    signal that something is wrong, and they need it immediately.
 *
 * Rate limited per account: this endpoint verifies a password, so without a
 * limit it is an oracle for guessing one.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const guard = await requireUser()
  if (!guard.ok) return guard.response

  // Reuses the two-factor rule: both verify a secret the caller already claims
  // to know, so both are guessing oracles without a limit.
  const limit = await checkRateLimit(`change-password:${guard.user.id}`, RULES.twoFactor)
  if (!limit.allowed) {
    return fail(
      'rate_limited',
      `Too many attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`,
      429,
    )
  }

  const parsed = await parseBody(request, changePasswordSchema)
  if (!parsed.success) return parsed.response

  const { currentPassword, newPassword } = parsed.data

  const valid = await verifyPassword(guard.user.passwordHash, currentPassword)
  if (!valid) {
    await recordAudit({
      actorId: guard.user.id,
      actorRole: guard.user.role,
      action: AuditAction.LoginFailed,
      targetType: 'user',
      targetId: guard.user.id,
      metadata: { reason: 'bad_current_password_on_change' },
      context: await getRequestContext(),
    })
    return fail('invalid_password', 'That is not your current password.', 401)
  }

  if (currentPassword === newPassword) {
    return fail('unchanged', 'The new password must be different from the current one.', 400)
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), updatedAt: new Date() })
    .where(eq(users.id, guard.user.id))

  // Keeps the caller signed in; ejects everyone else.
  await revokeOtherSessions(guard.user.id, guard.sessionId)

  await recordAudit({
    actorId: guard.user.id,
    actorRole: guard.user.role,
    action: AuditAction.PasswordChanged,
    targetType: 'user',
    targetId: guard.user.id,
    context: await getRequestContext(),
  })

  await sendSecurityAlert(
    guard.user.email,
    'Your password was changed. Every other signed-in device has been signed out. ' +
      'If this was not you, reset your password immediately and contact support.',
  )

  return ok({
    changed: true,
    message: 'Password updated. Every other device has been signed out.',
  })
})
