/**
 * Non-custodial wallet service.
 *
 * Distinct from `lib/api/wallet.ts`, which is the custodial model. These two
 * are alternatives, not layers: one reads an internal ledger, the other reads
 * the chain. `platform.walletModel` decides which the UI uses.
 */

import type { ApiResult } from '../types'
import { request, withFallback } from './client'

export type WalletChain = 'ethereum' | 'polygon' | 'arbitrum' | 'base' | 'optimism'

export interface LinkedWallet {
  id: string
  chain: WalletChain
  address: string
  label: string | null
  verifiedAt: string
  lastSyncedAt: string | null
}

export interface WalletChallenge {
  nonce: string
  message: string
  expiresAt: string
}

export interface ChainBalance {
  walletId: string | null
  label: string | null
  chain: WalletChain
  address: string
  symbol: string
  /** Decimal string — never parsed to a float before display. */
  amount: string
  raw: string
  blockNumber: string
  readAt: string
  usdValue: number | null
}

export interface BalancesResponse {
  wallets: ChainBalance[]
  /** Null when any wallet could not be read — see the endpoint's note. */
  totalUsd: number | null
  failures: Array<{ chain: WalletChain; address: string; reason: string }>
  message?: string
  pricesStale?: boolean
}

export async function listLinkedWallets(): Promise<
  ApiResult<{ wallets: LinkedWallet[]; supportedChains: WalletChain[] }>
> {
  return withFallback(
    () => request<{ wallets: LinkedWallet[]; supportedChains: WalletChain[] }>('/wallets'),
    () => ({ wallets: [], supportedChains: ['ethereum'] as WalletChain[] }),
    150,
  )
}

export async function requestChallenge(
  address: string,
  chain: WalletChain,
): Promise<WalletChallenge> {
  return request<WalletChallenge>('/wallets/challenge', {
    method: 'POST',
    body: { address, chain },
  })
}

export async function linkWallet(input: {
  nonce: string
  signature: string
  label?: string
}): Promise<LinkedWallet> {
  return request<LinkedWallet>('/wallets', { method: 'POST', body: input })
}

export async function unlinkWallet(id: string): Promise<{ unlinked: boolean }> {
  return request<{ unlinked: boolean }>(`/wallets/${id}`, { method: 'DELETE' })
}

export async function fetchChainBalances(): Promise<ApiResult<BalancesResponse>> {
  return withFallback(
    () => request<BalancesResponse>('/wallets/balances'),
    () => ({ wallets: [], totalUsd: null, failures: [], message: 'No backend configured.' }),
    200,
  )
}
