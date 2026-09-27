/**
 * Authentication service.
 *
 * IMPORTANT: there is no real authentication in this prototype. Every function
 * below validates input shape and returns a simulated result. Before launch,
 * implement these against a real backend that performs password hashing,
 * session/JWT issuance, rate limiting, email verification and 2FA.
 */

import { demoUser } from '../mock-data'
import type { ApiResult, User } from '../types'
import { request, withFallback } from './client'

export interface Credentials {
  email: string
  password: string
  remember?: boolean
}

export interface RegisterPayload {
  firstName: string
  lastName: string
  email: string
  password: string
  acceptedTerms: boolean
}

export interface AuthResponse {
  user: User
  authenticated: boolean
  demo?: boolean
  message?: string
  /** Set when the account has 2FA and the request carried no code yet. */
  requiresTwoFactor?: boolean
  emailVerified?: boolean
}

export interface RegisterResponse {
  registered: boolean
  /** 'unavailable' means no confirmation email was actually dispatched. */
  emailDelivery?: 'sent' | 'unavailable'
  message: string
  demo?: boolean
}

export async function login(credentials: Credentials): Promise<ApiResult<AuthResponse>> {
  return withFallback(
    () => request<AuthResponse>('/auth/login', { method: 'POST', body: credentials }),
    () => ({
      user: { ...demoUser, email: credentials.email },
      authenticated: false,
      demo: true,
      message: 'Demo environment — no account was signed in.',
    }),
    600,
  )
}

export async function register(payload: RegisterPayload): Promise<ApiResult<RegisterResponse>> {
  return withFallback(
    () => request<RegisterResponse>('/auth/register', { method: 'POST', body: payload }),
    () => ({
      registered: false,
      demo: true,
      message: 'Demo environment — no account was created.',
    }),
    700,
  )
}

export async function requestPasswordReset(email: string): Promise<ApiResult<{ sent: boolean; demo: boolean }>> {
  return withFallback(
    () => request<{ sent: boolean; demo: boolean }>('/auth/forgot-password', { method: 'POST', body: { email } }),
    () => ({ sent: false, demo: true }),
    600,
  )
}

export async function verifyEmail(token: string): Promise<ApiResult<{ verified: boolean; demo: boolean }>> {
  return withFallback(
    () => request<{ verified: boolean; demo: boolean }>('/auth/verify-email', { method: 'POST', body: { token } }),
    () => ({ verified: false, demo: true }),
    500,
  )
}

export async function resendVerification(email: string): Promise<ApiResult<{ sent: boolean; demo: boolean }>> {
  return withFallback(
    () => request<{ sent: boolean; demo: boolean }>('/auth/resend-verification', { method: 'POST', body: { email } }),
    () => ({ sent: false, demo: true }),
    500,
  )
}

export async function getCurrentUser(): Promise<ApiResult<User>> {
  return withFallback(
    // `/auth/me` answers with an envelope, not a bare user. Typing it as `User`
    // handed callers an object with no `firstName`, which is how the profile
    // screen ended up rendering sample data over a real session.
    async () => (await request<{ user: User }>('/auth/me')).user,
    () => demoUser,
    100,
  )
}

/* ------------------------------------------------------------------ */
/* Account — the signed-in user acting on their own record             */
/* ------------------------------------------------------------------ */

export interface AccountSummary {
  user: User
  emailVerified: boolean
  /** Prompts a re-issue before someone runs out and locks themselves out. */
  recoveryCodesRemaining: number
}

/**
 * The signed-in user's own record. No mock fallback.
 *
 * A sample identity on a profile screen is worse than an error: the person is
 * looking at their own name, email and verification status to check they are
 * right, and a placeholder answers that question falsely.
 */
export async function fetchAccount(): Promise<AccountSummary> {
  const response = await request<{
    user: User & { emailVerified?: boolean }
    recoveryCodesRemaining: number
  }>('/auth/me')

  return {
    user: response.user,
    emailVerified: Boolean(response.user.emailVerified),
    recoveryCodesRemaining: response.recoveryCodesRemaining,
  }
}

export interface ProfileUpdate {
  firstName?: string
  lastName?: string
  phone?: string
  country?: string
}

/** Email is deliberately not updatable — see the note on `PATCH /api/auth/me`. */
export async function updateProfile(changes: ProfileUpdate): Promise<{ user: User }> {
  return request('/auth/me', { method: 'PATCH', body: changes })
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ changed: boolean; message: string }> {
  return request('/auth/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  })
}

export async function logout(): Promise<ApiResult<{ ok: boolean }>> {
  return withFallback(
    () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
    () => ({ ok: true }),
    200,
  )
}

/* ------------------------------------------------------------------ */
/* Preferences                                                         */
/* ------------------------------------------------------------------ */

export interface Preferences {
  transactionEmails: boolean
  marketingEmails: boolean
  marketingConsentAt: string | null
  analyticsConsent: boolean
  analyticsConsentAt: string | null
  displayCurrency: string
  language: string
}

/**
 * No mock fallback. A preferences screen that shows invented values tells
 * someone they opted out of marketing when they did not.
 */
export async function fetchPreferences(): Promise<Preferences> {
  return (await request<{ preferences: Preferences }>('/account/preferences')).preferences
}

export interface PreferencesUpdate {
  transactionEmails?: boolean
  marketingEmails?: boolean
  analyticsConsent?: boolean
}

export async function savePreferences(changes: PreferencesUpdate): Promise<Preferences> {
  const response = await request<{ preferences: Preferences }>('/account/preferences', {
    method: 'PATCH',
    body: changes,
  })
  return response.preferences
}
