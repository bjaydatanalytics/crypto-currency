/**
 * Receiving-address service.
 *
 * Note what is missing here, deliberately: `withFallback`. Every other service
 * in this folder falls back to sample data when no backend is configured, so
 * the prototype stays browsable. A deposit address must never do that. A mock
 * address rendered next to a QR code is indistinguishable from a real one, and
 * the person reading it sends real money to it.
 *
 * So these call the API or they fail, and the UI renders the failure.
 */

import { request } from './client'

export interface UserDepositAddress {
  assetId: string
  network: string
  networkLabel: string
  address: string
  addressTag: string | null
  /** What the destination network calls its memo field, when it has one. */
  tagLabel: string | null
  custodian: string
  assignedAt: string
}

export interface AssetSummary {
  id: string
  symbol: string
  name: string
  color: string
  network: string | null
}

export interface UserDepositAddressesResponse {
  addresses: UserDepositAddress[]
  assets: AssetSummary[]
  awaitingAssignment: boolean
}

export async function fetchMyDepositAddresses(): Promise<UserDepositAddressesResponse> {
  return request<UserDepositAddressesResponse>('/wallet/deposit-addresses')
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export interface PlatformAddress {
  id: string
  assetId: string
  assetSymbol: string
  network: string
  address: string
  addressTag: string | null
  label: string
  custodian: string
  notes: string | null
  status: 'pending' | 'active' | 'revoked'
  assignedUsers: number
  createdAt: string
  revokedAt: string | null
}

export interface AwaitingUser {
  id: string
  name: string
  email: string
  kycStatus: string
  joined: string
}

export interface Assignment {
  id: string
  userId: string
  userEmail: string
  userName: string
  assetId: string
  assetSymbol: string
  network: string
  address: string
  addressTag: string | null
  custodian: string
  label: string | null
  status: 'pending' | 'active' | 'revoked'
  assignedAt: string
  revokedAt: string | null
}

export async function listPlatformAddresses(filter?: {
  assetId?: string
  network?: string
  status?: 'active' | 'revoked'
}): Promise<{ addresses: PlatformAddress[]; usersAwaitingAddress: AwaitingUser[] }> {
  return request('/admin/deposit-addresses', { query: filter })
}

export interface CreatePlatformAddressInput {
  assetId: string
  network: string
  address: string
  confirmAddress: string
  addressTag?: string
  label: string
  custodian: string
  notes?: string
}

export async function createPlatformAddress(
  input: CreatePlatformAddressInput,
): Promise<PlatformAddress> {
  return request<PlatformAddress>('/admin/deposit-addresses', { method: 'POST', body: input })
}

export async function retirePlatformAddress(
  id: string,
): Promise<{ revokedAssignments: number; message: string }> {
  return request(`/admin/deposit-addresses/${id}`, {
    method: 'PATCH',
    body: { status: 'revoked' },
  })
}

export async function listAssignments(filter?: {
  userId?: string
  sourceAddressId?: string
  includeRevoked?: boolean
}): Promise<{ assignments: Assignment[] }> {
  return request('/admin/deposit-assignments', { query: filter })
}

export async function assignAddress(input: {
  userId: string
  platformAddressId: string
}): Promise<Assignment> {
  return request<Assignment>('/admin/deposit-assignments', { method: 'POST', body: input })
}

export async function revokeAssignment(id: string): Promise<{ message: string }> {
  return request(`/admin/deposit-assignments/${id}`, { method: 'DELETE' })
}
