import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { withdrawals } from '@/db/ledger-schema'
import {
  badRequest,
  conflict,
  created,
  fail,
  ok,
  parseBody,
  withErrorHandling,
} from '@/lib/server/api'
import { AuditAction, recordAudit } from '@/lib/server/audit'
import { decryptSecret } from '@/lib/server/crypto'
import { requireKycVerified } from '@/lib/server/guard'
import { getRequestContext } from '@/lib/server/session'
import { verifyTotp } from '@/lib/server/totp'
import { WithdrawalError, requestWithdrawal } from '@/lib/server/transfers'

const withdrawalSchema = z.object({
  assetId: z.string().trim().min(1).max(32),
  /** Decimal string, not a number — floats cannot represent 18dp exactly. */
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,18})?$/, 'Enter a valid amount.')
    .refine((value) => Number(value) > 0, 'Amount must be greater than zero.'),
  addressId: z.string().uuid(),
  /** Required: 2FA is re-checked at the moment funds would leave. */
  totpCode: z.string().trim().regex(/^\d{6}$/, 'Enter your six-digit authentication code.'),
  /** Supplied by the client so a double-submit cannot pay out twice. */
  idempotencyKey: z.string().trim().min(8).max(200),
})

/** GET — the user's withdrawal history. */
export const GET = withErrorHandling(async () => {
  const guard = await requireKycVerified()
  if (!guard.ok) return guard.response

  const rows = await db
    .select()
    .from(withdrawals)
    .where(eq(withdrawals.userId, guard.user.id))
    .orderBy(desc(withdrawals.requestedAt))
    .limit(50)

  return ok({
    withdrawals: rows.map((row) => ({
      id: row.id,
      assetId: row.assetId,
      amount: row.amount,
      fee: row.fee,
      status: row.status,
      destinationAddress: row.destinationAddress,
      txHash: row.txHash,
      requestedAt: row.requestedAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      rejectionReason: row.rejectionReason,
    })),
  })
})

/**
 * POST — request a withdrawal.
 *
 * The highest-risk endpoint in the product. Every gate below is deliberate:
 *
 * - KYC verified — withdrawing to an unverified identity defeats the point of
 *   onboarding checks.
 * - 2FA re-verified here, not merely at sign-in. A hijacked session is the
 *   realistic attack, and this is the step that stops it draining the account.
 * - Allow-listed address with a cooling-off period (enforced in the service).
 * - Funds locked at request time, before any approval.
 * - Nothing is sent to the custodian here — payout needs a separate approval by
 *   a different operator.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const guard = await requireKycVerified()
  if (!guard.ok) return guard.response

  const parsed = await parseBody(request, withdrawalSchema)
  if (!parsed.success) return parsed.response

  const context = await getRequestContext()

  if (!guard.user.totpEnabledAt || !guard.user.totpSecret) {
    return fail(
      'two_factor_required',
      'Turn on two-factor authentication before withdrawing.',
      403,
    )
  }

  const secret = decryptSecret(guard.user.totpSecret)
  if (!secret) {
    // Fail closed. Never treat an undecryptable secret as "no 2FA required".
    return fail(
      'two_factor_unavailable',
      'Two-factor authentication cannot be verified right now. Contact support.',
      500,
    )
  }

  if (!verifyTotp(secret, parsed.data.totpCode, guard.user.email)) {
    await recordAudit({
      actorId: guard.user.id,
      actorRole: guard.user.role,
      action: AuditAction.LoginFailed,
      targetType: 'withdrawal',
      metadata: { reason: 'bad_totp_on_withdrawal' },
      context,
    })
    return fail('invalid_two_factor', 'That code is not valid.', 401)
  }

  try {
    const withdrawal = await requestWithdrawal({
      userId: guard.user.id,
      assetId: parsed.data.assetId,
      amount: parsed.data.amount,
      addressId: parsed.data.addressId,
      idempotencyKey: parsed.data.idempotencyKey,
    })

    await recordAudit({
      actorId: guard.user.id,
      actorRole: guard.user.role,
      action: AuditAction.WithdrawalRequested,
      targetType: 'withdrawal',
      targetId: withdrawal.id,
      metadata: {
        assetId: parsed.data.assetId,
        amount: parsed.data.amount,
        destinationAddress: withdrawal.destinationAddress,
      },
      context,
    })

    return created({
      id: withdrawal.id,
      status: withdrawal.status,
      message:
        'Withdrawal requested. Funds are locked and the request is awaiting review. ' +
        'Nothing has been sent yet.',
    })
  } catch (error) {
    if (error instanceof WithdrawalError) {
      if (error.code === 'insufficient_funds') return conflict(error.message)
      return badRequest(error.message)
    }
    throw error
  }
})
