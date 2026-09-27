import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { recoveryCodes, users } from '@/db/schema'
import { conflict, fail, ok, parseBody, withErrorHandling } from '@/lib/server/api'
import { AuditAction, recordAudit } from '@/lib/server/audit'
import { decryptSecret, encryptSecret, verifyPassword } from '@/lib/server/crypto'
import { requireVerifiedUser } from '@/lib/server/guard'
import { sendSecurityAlert } from '@/lib/server/mailer'
import { getRequestContext } from '@/lib/server/session'
import {
  buildOtpAuthUrl,
  createTotpSecret,
  issueRecoveryCodes,
  renderQrCode,
  verifyTotp,
} from '@/lib/server/totp'
import { disableTwoFactorSchema, enableTwoFactorSchema } from '@/lib/server/validation'

/**
 * POST — begin enrolment.
 *
 * Generates a secret and stores it encrypted, but leaves `totpEnabledAt` null.
 * 2FA is not active until the user proves they can produce a code (PUT below),
 * so a failed setup can never lock someone out of their own account.
 */
export const POST = withErrorHandling(async () => {
  const guard = await requireVerifiedUser()
  if (!guard.ok) return guard.response

  if (guard.user.totpEnabledAt) {
    return conflict('Two-factor authentication is already enabled.')
  }

  const secret = createTotpSecret()
  const otpauthUrl = buildOtpAuthUrl(secret, guard.user.email)

  await db
    .update(users)
    .set({ totpSecret: encryptSecret(secret), updatedAt: new Date() })
    .where(eq(users.id, guard.user.id))

  return ok({
    secret, // shown once, for manual entry when a QR cannot be scanned
    otpauthUrl,
    qrCode: await renderQrCode(otpauthUrl),
  })
})

/** PUT — confirm enrolment with a live code, then issue recovery codes. */
export const PUT = withErrorHandling(async (request: Request) => {
  const guard = await requireVerifiedUser()
  if (!guard.ok) return guard.response

  const parsed = await parseBody(request, enableTwoFactorSchema)
  if (!parsed.success) return parsed.response

  if (guard.user.totpEnabledAt) {
    return conflict('Two-factor authentication is already enabled.')
  }
  if (!guard.user.totpSecret) {
    return fail('setup_required', 'Start two-factor setup before confirming.', 400)
  }

  const secret = decryptSecret(guard.user.totpSecret)
  if (!secret) {
    return fail('setup_invalid', 'Setup could not be verified. Start again.', 500)
  }

  if (!verifyTotp(secret, parsed.data.code, guard.user.email)) {
    return fail('invalid_code', 'That code is not valid. Check your authenticator app.', 400)
  }

  await db
    .update(users)
    .set({ totpEnabledAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, guard.user.id))

  // Returned exactly once — only hashes are kept.
  const codes = await issueRecoveryCodes(guard.user.id)

  await sendSecurityAlert(guard.user.email, 'Two-factor authentication was enabled.')
  await recordAudit({
    actorId: guard.user.id,
    actorRole: guard.user.role,
    action: AuditAction.TwoFactorEnabled,
    targetType: 'user',
    targetId: guard.user.id,
    context: await getRequestContext(),
  })

  return ok({
    enabled: true,
    recoveryCodes: codes,
    message:
      'Two-factor authentication is on. Save these recovery codes now — they are shown only once.',
  })
})

/**
 * DELETE — turn 2FA off.
 *
 * Requires the password again. Disabling a second factor is exactly what an
 * attacker holding a live session wants to do, so possession of the session
 * alone is not enough.
 */
export const DELETE = withErrorHandling(async (request: Request) => {
  const guard = await requireVerifiedUser()
  if (!guard.ok) return guard.response

  const parsed = await parseBody(request, disableTwoFactorSchema)
  if (!parsed.success) return parsed.response

  if (!(await verifyPassword(guard.user.passwordHash, parsed.data.password))) {
    return fail('invalid_password', 'That password is not correct.', 401)
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ totpSecret: null, totpEnabledAt: null, updatedAt: new Date() })
      .where(eq(users.id, guard.user.id))
    await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, guard.user.id))
  })

  await sendSecurityAlert(guard.user.email, 'Two-factor authentication was disabled.')
  await recordAudit({
    actorId: guard.user.id,
    actorRole: guard.user.role,
    action: AuditAction.TwoFactorDisabled,
    targetType: 'user',
    targetId: guard.user.id,
    context: await getRequestContext(),
  })

  return ok({ enabled: false, message: 'Two-factor authentication has been turned off.' })
})
