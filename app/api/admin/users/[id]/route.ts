import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { kycRecords, sessions, users } from '@/db/schema'
import { badRequest, forbidden, notFound, ok, parseBody, withErrorHandling } from '@/lib/server/api'
import { AuditAction, recordAudit } from '@/lib/server/audit'
import { publicUser, requireAdmin } from '@/lib/server/guard'
import { getRequestContext } from '@/lib/server/session'
import { adminUpdateUserSchema } from '@/lib/server/validation'
import { and, isNull } from 'drizzle-orm'

/**
 * PATCH — update a user's status or KYC decision.
 *
 * Two constraints worth keeping:
 *
 * 1. An admin cannot act on their own account here. Self-service privilege or
 *    status changes remove the separation that makes the audit trail meaningful.
 * 2. Approving KYC is a compliance decision. This endpoint records *who*
 *    decided and when, because "the system approved it" is not an answer a
 *    regulator accepts.
 */
export const PATCH = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.response

    const { id } = await params

    if (id === guard.user.id) {
      return forbidden('You cannot change your own account from the admin panel.')
    }

    const parsed = await parseBody(request, adminUpdateUserSchema)
    if (!parsed.success) return parsed.response

    const { status, kycStatus, rejectionReason } = parsed.data
    if (!status && !kycStatus) return badRequest('Nothing to update.')

    if (kycStatus === 'rejected' && !rejectionReason) {
      return badRequest('A reason is required when rejecting verification.')
    }

    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1)
    if (!target) return notFound('User not found.')

    const now = new Date()

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(users)
        .set({
          ...(status ? { status } : {}),
          ...(kycStatus ? { kycStatus } : {}),
          updatedAt: now,
        })
        .where(eq(users.id, id))
        .returning()

      // Suspending must take effect immediately, not at session expiry.
      if (status && status !== 'active') {
        await tx
          .update(sessions)
          .set({ revokedAt: now })
          .where(and(eq(sessions.userId, id), isNull(sessions.revokedAt)))
      }

      if (kycStatus) {
        await tx
          .update(kycRecords)
          .set({
            status: kycStatus,
            rejectionReason: rejectionReason ?? null,
            reviewedAt: now,
            reviewedBy: guard.user.id,
          })
          .where(eq(kycRecords.userId, id))
      }

      return row
    })

    await recordAudit({
      actorId: guard.user.id,
      actorRole: 'admin',
      action: kycStatus ? AuditAction.KycReviewed : AuditAction.AdminUpdatedUser,
      targetType: 'user',
      targetId: id,
      metadata: {
        status,
        kycStatus,
        rejectionReason,
        previousStatus: target.status,
        previousKycStatus: target.kycStatus,
      },
      context: await getRequestContext(),
    })

    return ok({ user: publicUser(updated) })
  },
)
