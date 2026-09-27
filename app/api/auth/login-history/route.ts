import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { loginEvents } from '@/db/schema'
import { ok, withErrorHandling } from '@/lib/server/api'
import { requireUser } from '@/lib/server/guard'

/**
 * GET — the signed-in user's own sign-in history.
 *
 * Shown so a person can spot an access they do not recognise, which is the
 * single most useful thing a user can do about a compromised password.
 *
 * Failed attempts are included deliberately: a run of failures from an
 * unfamiliar address is the clearest early signal that someone is trying to
 * get in. Scoped to `userId`, so a failed attempt against an address that
 * never matched an account appears nowhere — those rows belong to no one.
 */
export const GET = withErrorHandling(async () => {
  const guard = await requireUser()
  if (!guard.ok) return guard.response

  const rows = await db
    .select({
      id: loginEvents.id,
      success: loginEvents.success,
      failureReason: loginEvents.failureReason,
      ipAddress: loginEvents.ipAddress,
      userAgent: loginEvents.userAgent,
      createdAt: loginEvents.createdAt,
    })
    .from(loginEvents)
    .where(eq(loginEvents.userId, guard.user.id))
    .orderBy(desc(loginEvents.createdAt))
    .limit(25)

  return ok({
    events: rows.map((row) => ({
      id: row.id,
      success: row.success,
      failureReason: row.failureReason,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      at: row.createdAt.toISOString(),
    })),
  })
})
