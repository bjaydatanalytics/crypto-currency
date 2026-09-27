import 'server-only'
import { redirect } from 'next/navigation'
import type { User } from '@/db/schema'

/**
 * Page-level authentication gates for server layouts.
 *
 * These replaced an Edge middleware. That is a deliberate upgrade, not a
 * workaround: middleware can only see whether a cookie is *present*, because
 * the Edge runtime has no database access. These gates load the session, verify
 * it against the database, and check the account is still active and the role
 * is right — the check that actually matters.
 *
 * Route handlers keep their own `requireUser` / `requireAdmin` guards. A page
 * gate protects the rendered page; it does not protect the API, and the API
 * must never rely on it.
 */

/**
 * True when a database is configured.
 *
 * Read directly rather than through `env` so this never throws: the mock build
 * has no DATABASE_URL and must still render.
 */
function isBackendConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL)
}

/**
 * Requires a signed-in user.
 *
 * Returns null in the mock build (no database), where the dashboard runs on
 * sample data and there is nothing to protect.
 */
export async function gateDashboard(): Promise<User | null> {
  if (!isBackendConfigured()) return null

  const { getCurrentSession } = await import('./session')
  const session = await getCurrentSession()

  if (!session) redirect('/login')
  return session.user
}

/**
 * Requires an admin.
 *
 * A signed-in non-admin is sent to the dashboard rather than shown a "forbidden"
 * page, so the admin surface isn't confirmed to exist for ordinary accounts.
 */
export async function gateAdmin(): Promise<User | null> {
  if (!isBackendConfigured()) return null

  const { getCurrentSession } = await import('./session')
  const session = await getCurrentSession()

  if (!session) redirect('/login')
  if (session.user.role !== 'admin') redirect('/dashboard')

  return session.user
}
