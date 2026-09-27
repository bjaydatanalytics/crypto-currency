/**
 * Account security service.
 *
 * No mock fallback anywhere. A sample "2FA is on" or an invented session list
 * is worse than an error: someone checking whether their account is secure
 * would be told it is when nobody actually knows.
 */

import { request } from './client'

export interface ActiveSession {
  id: string
  ipAddress: string | null
  userAgent: string | null
  lastActive: string
  createdAt: string
  /** The device making this request — never offered for revocation. */
  current: boolean
}

export async function listSessions(): Promise<{ sessions: ActiveSession[] }> {
  return request('/sessions')
}

export async function revokeSession(id: string): Promise<{ revoked: boolean }> {
  return request(`/sessions/${id}`, { method: 'DELETE' })
}

export async function revokeOtherSessions(): Promise<{ revoked: number; message: string }> {
  return request('/sessions', { method: 'DELETE' })
}

export interface LoginEvent {
  id: string
  success: boolean
  failureReason: string | null
  ipAddress: string | null
  userAgent: string | null
  at: string
}

export async function listLoginHistory(): Promise<{ events: LoginEvent[] }> {
  return request('/auth/login-history')
}

/* ------------------------------------------------------------------ */
/* Two-factor authentication                                           */
/* ------------------------------------------------------------------ */

export interface TwoFactorSetup {
  /** Shown once, for manual entry when a QR code cannot be scanned. */
  secret: string
  otpauthUrl: string
  /** Data URI. */
  qrCode: string
}

/** Begins enrolment. 2FA is NOT active until `confirmTwoFactor` succeeds. */
export async function startTwoFactor(): Promise<TwoFactorSetup> {
  return request('/auth/two-factor', { method: 'POST' })
}

export async function confirmTwoFactor(code: string): Promise<{
  enabled: boolean
  recoveryCodes: string[]
  message: string
}> {
  return request('/auth/two-factor', { method: 'PUT', body: { code } })
}

/** Requires the password again — a live session alone must not disable 2FA. */
export async function disableTwoFactor(password: string): Promise<{ message: string }> {
  return request('/auth/two-factor', { method: 'DELETE', body: { password } })
}
