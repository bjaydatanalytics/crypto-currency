/**
 * Admin service.
 *
 * Everything below hits a real endpoint behind `requireAdmin`. `listUsers` keeps
 * a mock fallback only for the no-backend build; the overview and user
 * administration calls have none, because an operator acts on what they show.
 */

import { adminUsers } from '../mock-data'
import type { AdminUserRow, ApiResult } from '../types'
import { request, withFallback } from './client'

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

export interface AdminQueue {
  awaitingKyc: number
  pendingDeposits: number
  creditableDeposits: number
  pendingWithdrawals: number
  approvedUnpaid: number
  maturedInvestments: number
  awaitingSupport: number
}

export interface AdminOverviewData {
  queue: AdminQueue
  totals: {
    users: number
    newUsers7d: number
    verifiedUsers: number
    activeInvestments: number
    publishedPlans: number
    draftPlans: number
    activeReceivingAddresses: number
  }
  treasury: {
    solvent: boolean
    positions: Array<{
      assetId: string
      symbol: string
      balance: string
      committed: string
      surplus: string
      funded: boolean
    }>
  }
  ledger: { balanced: boolean; imbalances: Array<{ assetId: string; imbalance: string }> }
  activity: Array<{ date: string; depositsCredited: number; withdrawalsPaid: number }>
  recentUsers: Array<{
    id: string
    name: string
    email: string
    verification: string
    joined: string
  }>
  clear: boolean
}

/**
 * The admin overview. No mock fallback.
 *
 * This is a work queue an operator acts on — a sample count here would mean
 * either believing there is nothing to do when customers are waiting, or
 * hunting for deposits that do not exist.
 */
export async function fetchAdminOverview(): Promise<AdminOverviewData> {
  return request<AdminOverviewData>('/admin/overview')
}

export async function listUsers(search = ''): Promise<ApiResult<AdminUserRow[]>> {
  return withFallback(
    // The route answers with an envelope, not a bare array. Typing it as an
    // array here is what made the users screen throw "users.map is not a
    // function" the moment a backend was configured.
    async () => {
      const response = await request<{ items: AdminUserRow[] }>('/admin/users', {
        query: { search: search || undefined },
      })
      return response.items
    },
    () => {
      const term = search.trim().toLowerCase()
      if (!term) return adminUsers
      return adminUsers.filter(
        (u) => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term),
      )
    },
  )
}

/* ------------------------------------------------------------------ */
/* User administration                                                 */
/* ------------------------------------------------------------------ */

export type VerificationDecision = 'verified' | 'rejected' | 'pending' | 'unverified'
export type AccountStatus = 'active' | 'suspended' | 'closed'

/** A user row with everything a compliance reviewer needs to decide. */
export interface AdminUserRecord {
  id: string
  name: string
  email: string
  role: 'user' | 'admin'
  status: AccountStatus
  verification: VerificationDecision
  emailVerified: boolean
  joined: string
  lastLoginAt: string | null
  /** Null when the customer never submitted anything to a KYC provider. */
  kycSubmittedAt: string | null
  kycProvider: string | null
  kycProviderReference: string | null
  kycRejectionReason: string | null
  /** True only when KYC *and* email verification both pass. */
  canDeposit: boolean
}

export interface AdminUserPage {
  items: AdminUserRecord[]
  page: number
  pageSize: number
  total: number
}

/**
 * The real user list, with no mock fallback.
 *
 * Backs the verification queue. A sample row here would mean approving a
 * customer who does not exist, or — worse — believing a real one was approved.
 */
export async function fetchUsers(filter?: {
  search?: string
  kycStatus?: VerificationDecision
  status?: AccountStatus
  page?: number
  pageSize?: number
}): Promise<AdminUserPage> {
  return request<AdminUserPage>('/admin/users', {
    query: {
      search: filter?.search || undefined,
      kycStatus: filter?.kycStatus,
      status: filter?.status,
      page: filter?.page,
      pageSize: filter?.pageSize,
    },
  })
}

/**
 * Records a verification decision.
 *
 * `rejectionReason` is required by the server when rejecting — the customer is
 * entitled to know why they were refused.
 */
export async function decideVerification(
  userId: string,
  kycStatus: VerificationDecision,
  rejectionReason?: string,
): Promise<{ user: { id: string; verification: string } }> {
  return request(`/admin/users/${userId}`, {
    method: 'PATCH',
    body: { kycStatus, ...(rejectionReason ? { rejectionReason } : {}) },
  })
}

/** Suspending revokes every live session immediately, server-side. */
export async function setAccountStatus(
  userId: string,
  status: AccountStatus,
): Promise<{ user: { id: string; status: string } }> {
  return request(`/admin/users/${userId}`, { method: 'PATCH', body: { status } })
}

export interface AdminUserSearchResult {
  id: string
  name: string
  email: string
  status: string
  verification: string
}

/**
 * Searches real user records via `/admin/users`.
 *
 * Distinct from `listUsers` above, which serves the mock-data prototype and
 * flattens the response. This one matches the route's actual envelope and has
 * no fallback: it backs the address-assignment picker, where choosing a person
 * from sample data would assign a receiving address to nobody.
 */
export async function searchAdminUsers(search = ''): Promise<AdminUserSearchResult[]> {
  const response = await request<{ items: AdminUserSearchResult[] }>('/admin/users', {
    query: { search: search || undefined, pageSize: 20 },
  })
  return response.items
}


