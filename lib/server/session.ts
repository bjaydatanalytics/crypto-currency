import 'server-only'
import { cookies, headers } from 'next/headers'
import { and, eq, gt, isNull, lt, ne, sql } from 'drizzle-orm'
import { db } from '@/db'
import { sessions, users, type User } from '@/db/schema'
import { generateToken, hashToken } from './crypto'
import { env } from './env'

// Re-exported for convenience; defined in a dependency-free module so the
// Edge middleware can read it without pulling in Node crypto.
export { SESSION_COOKIE } from '@/lib/session-cookie'
import { SESSION_COOKIE } from '@/lib/session-cookie'

/** Absolute lifetime. Beyond this the user signs in again, active or not. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
/** Idle window. A session untouched for this long is treated as dead. */
const IDLE_TTL_MS = 14 * 24 * 60 * 60 * 1000 // 14 days
/** How often `lastActiveAt` is written — avoids a write on every request. */
const ACTIVITY_WRITE_INTERVAL_MS = 5 * 60 * 1000

export interface RequestContext {
  ipAddress: string | null
  userAgent: string | null
}

/**
 * Client IP.
 *
 * Only trust the leftmost x-forwarded-for entry when a proxy you control sets
 * it. On Vercel that holds; behind a different proxy, verify before relying on
 * this for rate limiting.
 */
export async function getRequestContext(): Promise<RequestContext> {
  const headerList = await headers()
  const forwarded = headerList.get('x-forwarded-for')
  const ip =
    headerList.get('x-real-ip') ??
    (forwarded ? forwarded.split(',')[0]?.trim() : null) ??
    null

  return { ipAddress: ip, userAgent: headerList.get('user-agent') }
}

/** Issues a session and sets the cookie. Returns the plaintext token. */
export async function createSession(userId: string, context: RequestContext) {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

  const [session] = await db
    .insert(sessions)
    .values({
      userId,
      tokenHash: hashToken(token),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      expiresAt,
    })
    .returning()

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true, // unreadable from JavaScript, so XSS can't exfiltrate it
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax', // sent on top-level navigation, not on cross-site POSTs
    path: '/',
    expires: expiresAt,
  })

  return session
}

export interface AuthenticatedUser {
  user: User
  sessionId: string
}

/**
 * Resolves the current session, or null.
 *
 * Enforces both the absolute expiry and the idle window, and confirms the
 * account is still active — a suspended user's existing session must stop
 * working immediately, not at expiry.
 */
export async function getCurrentSession(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const now = new Date()
  const idleCutoff = new Date(now.getTime() - IDLE_TTL_MS)

  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
        gt(sessions.lastActiveAt, idleCutoff),
      ),
    )
    .limit(1)

  const row = rows[0]
  if (!row) return null
  if (row.user.status !== 'active') return null

  // A password change invalidates every session issued before it.
  if (row.session.createdAt < row.user.passwordChangedAt) {
    await revokeSession(row.session.id)
    return null
  }

  // Throttled activity write: one per interval, not one per request.
  if (now.getTime() - row.session.lastActiveAt.getTime() > ACTIVITY_WRITE_INTERVAL_MS) {
    await db
      .update(sessions)
      .set({ lastActiveAt: now })
      .where(eq(sessions.id, row.session.id))
  }

  return { user: row.user, sessionId: row.session.id }
}

export async function revokeSession(sessionId: string) {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)))
}

/** Used by "sign out all other devices" and after a password change. */
export async function revokeOtherSessions(userId: string, keepSessionId?: string) {
  const conditions = [eq(sessions.userId, userId), isNull(sessions.revokedAt)]
  if (keepSessionId) conditions.push(ne(sessions.id, keepSessionId))

  const revoked = await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(...conditions))
    .returning({ id: sessions.id })

  return revoked.length
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

/** Lists a user's live sessions, marking which one is making this request. */
export async function listActiveSessions(userId: string, currentSessionId: string) {
  const now = new Date()
  const rows = await db
    .select()
    .from(sessions)
    .where(
      and(eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)),
    )
    .orderBy(sql`${sessions.lastActiveAt} desc`)

  return rows.map((row) => ({
    id: row.id,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    lastActive: row.lastActiveAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    current: row.id === currentSessionId,
  }))
}

/** Housekeeping for the cron job: drop rows that can no longer authenticate. */
export async function purgeExpiredSessions() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const deleted = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, cutoff))
    .returning({ id: sessions.id })
  return deleted.length
}
