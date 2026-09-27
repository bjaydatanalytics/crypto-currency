import { ok, withErrorHandling } from '@/lib/server/api'
import { AuditAction, recordAudit } from '@/lib/server/audit'
import { requireUser } from '@/lib/server/guard'
import {
  getRequestContext,
  listActiveSessions,
  revokeOtherSessions,
} from '@/lib/server/session'

/** GET — the user's live sessions, so they can spot one they don't recognise. */
export const GET = withErrorHandling(async () => {
  const guard = await requireUser()
  if (!guard.ok) return guard.response

  return ok({ sessions: await listActiveSessions(guard.user.id, guard.sessionId) })
})

/**
 * DELETE — sign out everywhere else.
 *
 * Keeps the current session so the user isn't logged out of the device they're
 * using to secure the account.
 */
export const DELETE = withErrorHandling(async () => {
  const guard = await requireUser()
  if (!guard.ok) return guard.response

  const revoked = await revokeOtherSessions(guard.user.id, guard.sessionId)

  await recordAudit({
    actorId: guard.user.id,
    actorRole: guard.user.role,
    action: AuditAction.AllSessionsRevoked,
    targetType: 'user',
    targetId: guard.user.id,
    metadata: { revoked },
    context: await getRequestContext(),
  })

  return ok({ revoked, message: `Signed out of ${revoked} other session(s).` })
})
