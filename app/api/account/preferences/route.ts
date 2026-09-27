import { ok, parseBody, withErrorHandling } from '@/lib/server/api'
import { AuditAction, recordAudit } from '@/lib/server/audit'
import { requireUser } from '@/lib/server/guard'
import { getPreferences, updatePreferences } from '@/lib/server/preferences'
import { getRequestContext } from '@/lib/server/session'
import { updatePreferencesSchema } from '@/lib/server/validation'

/** GET — the signed-in user's preferences, or the documented defaults. */
export const GET = withErrorHandling(async () => {
  const guard = await requireUser()
  if (!guard.ok) return guard.response

  return ok({ preferences: await getPreferences(guard.user.id) })
})

/**
 * PATCH — save preferences.
 *
 * Consent changes are audited with their previous value. Whether someone had
 * agreed to marketing at a given moment is a question that gets asked in
 * earnest — by the person themselves, or by a regulator — and the answer has
 * to come from a record rather than the current state of a boolean.
 */
export const PATCH = withErrorHandling(async (request: Request) => {
  const guard = await requireUser()
  if (!guard.ok) return guard.response

  const parsed = await parseBody(request, updatePreferencesSchema)
  if (!parsed.success) return parsed.response

  const before = await getPreferences(guard.user.id)
  const preferences = await updatePreferences(guard.user.id, parsed.data)

  const consentChanged =
    before.marketingEmails !== preferences.marketingEmails ||
    before.analyticsConsent !== preferences.analyticsConsent

  if (consentChanged) {
    await recordAudit({
      actorId: guard.user.id,
      actorRole: guard.user.role,
      action: AuditAction.ConsentChanged,
      targetType: 'user',
      targetId: guard.user.id,
      metadata: {
        marketingEmails: { from: before.marketingEmails, to: preferences.marketingEmails },
        analyticsConsent: { from: before.analyticsConsent, to: preferences.analyticsConsent },
      },
      context: await getRequestContext(),
    })
  }

  return ok({ preferences })
})
