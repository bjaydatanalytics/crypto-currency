import 'server-only'
import type { NextResponse } from 'next/server'
import type { User } from '@/db/schema'
import { forbidden, unauthorized } from './api'
import { getCurrentSession } from './session'

/**
 * Route guards.
 *
 * Authorization is evaluated here, on the server, on every request. Middleware
 * alone is not sufficient: it can be bypassed by direct route invocation in
 * some deployment topologies, and it cannot see the database. Treat the
 * middleware check as a fast redirect for humans and these guards as the real
 * control.
 */

export type GuardResult =
  | { ok: true; user: User; sessionId: string }
  | { ok: false; response: NextResponse }

export async function requireUser(): Promise<GuardResult> {
  const session = await getCurrentSession()
  if (!session) return { ok: false, response: unauthorized() }
  return { ok: true, user: session.user, sessionId: session.sessionId }
}

/**
 * Requires a verified email address.
 *
 * Applied to anything that acts on the account rather than merely reading it,
 * so an unverified address cannot be used to take actions on someone else's
 * behalf.
 */
export async function requireVerifiedUser(): Promise<GuardResult> {
  const result = await requireUser()
  if (!result.ok) return result

  if (!result.user.emailVerifiedAt) {
    return {
      ok: false,
      response: forbidden('Confirm your email address before continuing.'),
    }
  }
  return result
}

/** Requires an admin role. Checked against the database row, not a cookie claim. */
export async function requireAdmin(): Promise<GuardResult> {
  const result = await requireUser()
  if (!result.ok) return result

  if (result.user.role !== 'admin') {
    // 404 rather than 403: don't confirm that an admin surface exists here.
    return { ok: false, response: forbidden('Not found.') }
  }
  return result
}

/**
 * Requires KYC to have been approved.
 *
 * The gate for anything that would touch money. Nothing in the current build
 * moves value, but the guard exists so those routes cannot later be added
 * without it.
 */
export async function requireKycVerified(): Promise<GuardResult> {
  const result = await requireVerifiedUser()
  if (!result.ok) return result

  if (result.user.kycStatus !== 'verified') {
    return {
      ok: false,
      response: forbidden('Identity verification must be complete before you can do that.'),
    }
  }
  return result
}

/** Strips sensitive columns before a user row crosses the network. */
export function publicUser(user: User) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    status: user.status,
    verification: user.kycStatus,
    emailVerified: Boolean(user.emailVerifiedAt),
    twoFactorEnabled: Boolean(user.totpEnabledAt),
    country: user.country,
    phone: user.phone,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  }
}

export type PublicUser = ReturnType<typeof publicUser>
