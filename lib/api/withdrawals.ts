/**
 * Withdrawals and the payout addresses they go to.
 *
 * No mock fallback anywhere in this file. A simulated withdrawal is one the
 * customer believes has been paid, and that is the single most damaging thing
 * this product could pretend about.
 */

import { request } from './client'

export interface WithdrawalAddress {
  id: string
  assetId: string
  network: string
  address: string
  addressTag: string | null
  label: string | null
  /** Withdrawals to this address are refused before this timestamp. */
  activeFrom: string
}

export interface WithdrawalRecord {
  id: string
  assetId: string
  amount: string
  fee: string
  status:
    | 'requested'
    | 'pending_approval'
    | 'approved'
    | 'broadcasting'
    | 'completed'
    | 'rejected'
    | 'failed'
  destinationAddress: string
  txHash: string | null
  requestedAt: string
  completedAt: string | null
  rejectionReason: string | null
}

/** Usable addresses, plus any still inside the cooling-off window. */
export async function listWithdrawalAddresses(): Promise<{
  addresses: WithdrawalAddress[]
  pending: WithdrawalAddress[]
}> {
  return request('/wallet/withdrawal-addresses')
}

export async function addWithdrawalAddress(input: {
  assetId: string
  network: string
  address: string
  addressTag?: string
  label?: string
}): Promise<{ address: WithdrawalAddress; message: string }> {
  return request('/wallet/withdrawal-addresses', { method: 'POST', body: input })
}

export async function listWithdrawals(): Promise<{ withdrawals: WithdrawalRecord[] }> {
  return request('/wallet/withdrawals')
}

export interface WithdrawalRequest {
  assetId: string
  /** Decimal string in asset units — never a float. */
  amount: string
  addressId: string
  /** Re-checked at the moment funds would leave; six digits. */
  totpCode: string
  idempotencyKey: string
}

export async function requestWithdrawal(
  input: WithdrawalRequest,
): Promise<{ withdrawal: WithdrawalRecord; message: string }> {
  return request('/wallet/withdrawals', { method: 'POST', body: input })
}
