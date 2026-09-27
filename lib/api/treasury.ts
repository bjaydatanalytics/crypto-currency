/**
 * Deposit and withdrawal operations service (admin).
 *
 * Like `deposit-addresses.ts`, and for the same reason: no `withFallback`.
 * Every call here either reaches the server or fails visibly. A mock deposit
 * row on this screen is a customer whose money an operator believes has
 * arrived, and a mock withdrawal is one they believe they have paid.
 */

import { request } from './client'

export type DepositStatus = 'detected' | 'confirming' | 'credited' | 'failed' | 'rejected'

export interface DepositRow {
  id: string
  userId: string
  userName: string
  userEmail: string
  assetId: string
  assetSymbol: string
  amount: string
  network: string
  networkLabel: string
  address: string
  txHash: string | null
  confirmations: number
  requiredConfirmations: number
  status: DepositStatus
  /** Confirmed enough to credit, and not already credited or rejected. */
  creditable: boolean
  detectedAt: string
  creditedAt: string | null
}

export async function listDeposits(filter?: {
  status?: DepositStatus
  userId?: string
}): Promise<{ deposits: DepositRow[] }> {
  return request('/admin/deposits', { query: filter })
}

export interface RecordDepositInput {
  userId: string
  assetId: string
  network?: string
  amount: string
  txHash: string
  confirmations: number
  notes?: string
}

export async function recordDeposit(input: RecordDepositInput): Promise<{
  id: string
  status: DepositStatus
  confirmations: number
  requiredConfirmations: number
  creditable: boolean
  message: string
}> {
  return request('/admin/deposits', { method: 'POST', body: input })
}

export async function creditDeposit(id: string): Promise<{ message: string }> {
  return request(`/admin/deposits/${id}`, { method: 'POST', body: { action: 'credit' } })
}

export async function rejectDeposit(id: string, reason: string): Promise<{ message: string }> {
  return request(`/admin/deposits/${id}`, {
    method: 'POST',
    body: { action: 'reject', reason },
  })
}

export async function setDepositConfirmations(
  id: string,
  confirmations: number,
): Promise<{ confirmations: number; required: number; creditable: boolean; message: string }> {
  return request(`/admin/deposits/${id}`, {
    method: 'POST',
    body: { action: 'confirmations', confirmations },
  })
}

/* ------------------------------------------------------------------ */
/* Withdrawals                                                         */
/* ------------------------------------------------------------------ */

export type WithdrawalStatus =
  | 'requested'
  | 'pending_approval'
  | 'approved'
  | 'broadcasting'
  | 'completed'
  | 'rejected'
  | 'failed'

export interface WithdrawalRow {
  id: string
  userId: string
  userName: string
  userEmail: string
  assetId: string
  assetSymbol: string
  amount: string
  fee: string
  network: string
  networkLabel: string
  destinationAddress: string
  destinationTag: string | null
  status: WithdrawalStatus
  txHash: string | null
  rejectionReason: string | null
  requestedAt: string
  approvedBy: string | null
  approvedAt: string | null
  completedAt: string | null
}

export async function listWithdrawals(filter?: {
  status?: 'pending_approval' | 'approved' | 'completed' | 'rejected'
}): Promise<{ withdrawals: WithdrawalRow[] }> {
  return request('/admin/withdrawals', { query: filter })
}

export async function approveWithdrawal(id: string): Promise<{ message: string }> {
  return request(`/admin/withdrawals/${id}`, { method: 'POST', body: { action: 'approve' } })
}

export async function settleWithdrawal(
  id: string,
  txHash: string,
): Promise<{ message: string }> {
  return request(`/admin/withdrawals/${id}`, {
    method: 'POST',
    body: { action: 'settle', txHash },
  })
}

export async function rejectWithdrawal(id: string, reason: string): Promise<{ message: string }> {
  return request(`/admin/withdrawals/${id}`, {
    method: 'POST',
    body: { action: 'reject', reason },
  })
}
