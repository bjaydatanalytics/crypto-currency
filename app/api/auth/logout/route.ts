import { ok, withErrorHandling } from '@/lib/server/api'
import { AuditAction, recordAudit } from '@/lib/server/audit'
import {
  clearSessionCookie,
  getCurrentSession,
  getRequestContext,
  revokeSession,
} from '@/lib/server/session'

export const POST = withErrorHandling(async () => {
  const session = await getCurrentSession()

  if (session) {
    // Revoke server-side as well as clearing the cookie: a copied cookie value
    // must stop working, not just disappear from this browser.
    await revokeSession(session.sessionId)
    await recordAudit({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: AuditAction.UserLoggedOut,
      targetType: 'session',
      targetId: session.sessionId,
      context: await getRequestContext(),
    })
  }

  await clearSessionCookie()

  // Always 200: signing out when already signed out is not an error.
  return ok({ ok: true })
})
