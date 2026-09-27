import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { badRequest, ok, parseBody, withErrorHandling } from '@/lib/server/api'
import { AuditAction, recordAudit } from '@/lib/server/audit'
import { publicUser, requireUser } from '@/lib/server/guard'
import { getRequestContext } from '@/lib/server/session'
import { countUnusedRecoveryCodes } from '@/lib/server/totp'
import { updateProfileSchema } from '@/lib/server/validation'

export const GET = withErrorHandling(async () => {
  const guard = await requireUser()
  if (!guard.ok) return guard.response

  // Surfaced so the UI can prompt a re-issue before the user runs out and
  // locks themselves out of their own account.
  const recoveryCodesRemaining = guard.user.totpEnabledAt
    ? await countUnusedRecoveryCodes(guard.user.id)
    : 0

  return ok({ user: publicUser(guard.user), recoveryCodesRemaining })
})

/**
 * PATCH — update the signed-in user's own profile.
 *
 * Deliberately narrow. Only name, phone and country are writable here.
 *
 * **Email is not.** Changing the address on an account is an account-takeover
 * step, not a profile edit: it needs the new address proved by a verification
 * link and the old one notified, or a stolen session quietly reassigns the
 * account. Until that flow exists, this endpoint refuses rather than
 * pretending, and the form says so.
 *
 * Role, status and KYC are absent for the same reason — nobody grants
 * themselves privileges through a profile form.
 */
export const PATCH = withErrorHandling(async (request: Request) => {
  const guard = await requireUser()
  if (!guard.ok) return guard.response

  const parsed = await parseBody(request, updateProfileSchema)
  if (!parsed.success) return parsed.response

  const { firstName, lastName, phone, country } = parsed.data

  // Empty string means "clear it"; undefined means "leave it alone". Collapsing
  // the two would make it impossible to remove a phone number once set.
  const changes = {
    ...(firstName !== undefined && { firstName }),
    ...(lastName !== undefined && { lastName }),
    ...(phone !== undefined && { phone: phone === '' ? null : phone }),
    ...(country !== undefined && { country: country === '' ? null : country }),
  }

  if (Object.keys(changes).length === 0) return badRequest('Nothing to update.')

  const [updated] = await db
    .update(users)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(users.id, guard.user.id))
    .returning()

  await recordAudit({
    actorId: guard.user.id,
    actorRole: guard.user.role,
    action: AuditAction.ProfileUpdated,
    targetType: 'user',
    targetId: guard.user.id,
    metadata: { fields: Object.keys(changes) },
    context: await getRequestContext(),
  })

  return ok({ user: publicUser(updated) })
})
