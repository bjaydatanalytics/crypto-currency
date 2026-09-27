/**
 * Plan administration service.
 *
 * No `withFallback` anywhere here. Plan terms are a financial promotion, and a
 * mock minimum or fee rendered in an editor is a term an operator could
 * believe they had saved. These call the API or they fail.
 */

import type { InvestmentPlan, PlanTier } from '../types'
import { request } from './client'

export interface AdminPlan extends InvestmentPlan {
  published: boolean
  displayOrder: number
  updatedAt: string
}

export interface PlanPayload {
  tier: PlanTier
  /** Null for a plan that promises no return. */
  fixedRatePercent: number | null
  rateBasis: 'per_term' | 'annual'
  /** Required to publish a plan that promises a return. */
  yieldSource: string | null
  name: string
  summary: string
  minimumAmount: number | null
  maximumAmount: number | null
  fee: number | null
  duration: number | null
  currency: string
  features: string[]
  riskDisclosure: string
  popular: boolean
  published: boolean
  displayOrder: number
}

export async function listAdminPlans(): Promise<{ plans: AdminPlan[] }> {
  return request('/admin/plans')
}

export async function createPlan(input: PlanPayload): Promise<AdminPlan> {
  return request<AdminPlan>('/admin/plans', { method: 'POST', body: input })
}

export async function updatePlan(
  id: string,
  input: Partial<PlanPayload>,
): Promise<AdminPlan> {
  return request<AdminPlan>(`/admin/plans/${id}`, { method: 'PATCH', body: input })
}

export async function deletePlan(id: string): Promise<{ message: string }> {
  return request(`/admin/plans/${id}`, { method: 'DELETE' })
}
