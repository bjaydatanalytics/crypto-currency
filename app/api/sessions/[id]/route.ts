import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { sessions } from '@/db/schema'
import { notFound, ok, withErrorHandling } from '@/lib/server/api'
import { AuditAction, recordAudit } from '@/lib/server/audit'
import { requireUser } from '@/lib/server/guard'
import { getRequestContext } from '@/lib/server/session'

/** DELETE — revoke one session by id. */
export const DELETE = withErrorHandling(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const guard = await requireUser()
    if (!guard.ok) return guard.response

    const { id } = await params

    /**
     * Scoped to the caller's own user id.
     *
     * Without that predicate this would let any signed-in user revoke any
     * session on the platform by guessing an id — a trivial denial of service
     * against other customers.
     */
    const revoked = await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(sessions.id, id),
          eq(sessions.userId, guard.user.id),
          isNull(sessions.revokedAt),
        ),
      )
      .returning({ id: sessions.id })

    if (revoked.length === 0) return notFound('That session was not found.')

    await recordAudit({
      actorId: guard.user.id,
      actorRole: guard.user.role,
      action: AuditAction.SessionRevoked,
      targetType: 'session',
      targetId: id,
      context: await getRequestContext(),
    })

    return ok({ revoked: true })
  },
)
