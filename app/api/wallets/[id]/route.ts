import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { linkedWallets } from '@/db/wallet-schema'
import { notFound, ok, withErrorHandling } from '@/lib/server/api'
import { AuditAction, recordAudit } from '@/lib/server/audit'
import { requireVerifiedUser } from '@/lib/server/guard'
import { getRequestContext } from '@/lib/server/session'

/**
 * DELETE — unlink a wallet.
 *
 * Scoped to the caller's own rows, so an id from another account cannot be
 * unlinked by guessing.
 *
 * Marked revoked rather than deleted: the audit trail should still show that
 * the address was once linked and when that stopped. Unlinking affects only
 * what this dashboard reads — it has no effect on the wallet or its funds.
 */
export const DELETE = withErrorHandling(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const guard = await requireVerifiedUser()
    if (!guard.ok) return guard.response

    const { id } = await params

    const revoked = await db
      .update(linkedWallets)
      .set({ status: 'revoked', revokedAt: new Date() })
      .where(
        and(
          eq(linkedWallets.id, id),
          eq(linkedWallets.userId, guard.user.id),
          isNull(linkedWallets.revokedAt),
        ),
      )
      .returning({ id: linkedWallets.id, address: linkedWallets.address })

    if (revoked.length === 0) return notFound('That wallet is not linked to your account.')

    await recordAudit({
      actorId: guard.user.id,
      actorRole: guard.user.role,
      action: AuditAction.ProfileUpdated,
      targetType: 'linked_wallet',
      targetId: id,
      metadata: { unlinked: revoked[0].address },
      context: await getRequestContext(),
    })

    return ok({ unlinked: true })
  },
)
