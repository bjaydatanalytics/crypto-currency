/**
 * Investment plans and contracts.
 *
 * No mock fallback anywhere in this file. Every figure here is either a
 * commercial term a customer will act on or a contract they have already
 * entered — a sample minimum, rate or balance would be a term the operator
 * never agreed to, or a contract that does not exist.
 */

import type { InvestmentPlan } from '../types'
import { request } from './client'

export async function listPlans(): Promise<InvestmentPlan[]> {
  return request<InvestmentPlan[]>('/plans')
}

export async function fetchPlan(id: string): Promise<InvestmentPlan> {
  return request<InvestmentPlan>(`/plans/${id}`)
}

/* ------------------------------------------------------------------ */
/* Contracts                                                           */
/* ------------------------------------------------------------------ */

export type InvestmentState = 'active' | 'matured' | 'cancelled'

export interface InvestmentContract {
  id: string
  planId: string
  planName: string
  assetId: string
  assetSymbol: string
  /** Decimal strings throughout — never parsed to a float for arithmetic. */
  principal: string
  fixedRatePercent: string
  rateBasis: 'per_term' | 'annual'
  durationDays: number
  /** Frozen at subscription. This is what is owed, not a projection. */
  expectedReturn: string
  totalAtMaturity: string
  yieldSource: string
  riskDisclosure: string
  status: InvestmentState
  startedAt: string
  maturesAt: string
  maturedAt: string | null
  cancelledAt: string | null
  cancellationReason: string | null
  daysRemaining: number
}

export async function listMyInvestments(
  status?: InvestmentState,
): Promise<{ investments: InvestmentContract[] }> {
  return request('/investments', { query: { status } })
}

export interface SubscribeInput {
  planId: string
  assetId: string
  /** Decimal string in asset units. */
  amount: string
  idempotencyKey: string
  acceptedTerms: boolean
}

export async function subscribeToPlan(
  input: SubscribeInput,
): Promise<{ investment: InvestmentContract; message: string }> {
  return request('/investments', { method: 'POST', body: input })
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export interface AdminInvestmentContract extends InvestmentContract {
  userId: string
  userEmail: string
  userName: string
}

export async function listAllInvestments(
  status?: InvestmentState,
): Promise<{ investments: AdminInvestmentContract[] }> {
  return request('/admin/investments', { query: { status } })
}

export async function matureInvestment(
  id: string,
): Promise<{ investment: AdminInvestmentContract; message: string }> {
  return request(`/admin/investments/${id}`, { method: 'POST', body: { action: 'mature' } })
}

export async function cancelInvestment(
  id: string,
  reason: string,
): Promise<{ investment: AdminInvestmentContract; message: string }> {
  return request(`/admin/investments/${id}`, {
    method: 'POST',
    body: { action: 'cancel', reason },
  })
}

/* ------------------------------------------------------------------ */
/* Treasury                                                            */
/* ------------------------------------------------------------------ */

export interface TreasuryPosition {
  assetId: string
  symbol: string
  balance: string
  /** Total return owed on contracts not yet matured. */
  committed: string
  /** balance − committed. Negative means promises exceed funds held. */
  surplus: string
  funded: boolean
}

export async function fetchTreasury(): Promise<{
  positions: TreasuryPosition[]
  solvent: boolean
}> {
  return request('/admin/treasury')
}

export async function fundTreasury(input: {
  assetId: string
  amount: string
  note?: string
  idempotencyKey: string
}): Promise<{ assetId: string; balance: string; message: string }> {
  return request('/admin/treasury', { method: 'POST', body: input })
}
