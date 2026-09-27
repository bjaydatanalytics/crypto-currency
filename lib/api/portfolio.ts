/** Portfolio service — holdings, valuation and performance history. */

import { platform } from '../config'
import { demoPortfolio } from '../mock-data'
import type { ApiResult, Holding, Portfolio, PricePoint } from '../types'
import { request, withCapability } from './client'

/** A real account with no custody behind it holds nothing. */
const emptyPortfolio = (): Portfolio => ({
  totalValue: 0,
  change24h: 0,
  changePercent24h: 0,
  availableBalance: 0,
  investedAmount: 0,
  holdings: [],
  performance: [],
})

export async function fetchPortfolio(): Promise<ApiResult<Portfolio>> {
  return withCapability(
    platform.portfolioServiceEnabled,
    () => request<Portfolio>('/portfolio'),
    emptyPortfolio,
    () => demoPortfolio,
  )
}

export async function fetchHoldings(): Promise<ApiResult<Holding[]>> {
  return withCapability(
    platform.portfolioServiceEnabled,
    () => request<Holding[]>('/portfolio/holdings'),
    () => [],
    () => demoPortfolio.holdings,
  )
}

export type PerformanceRange = '7D' | '30D' | '90D' | 'ALL'

export async function fetchPerformance(
  range: PerformanceRange = '30D',
): Promise<ApiResult<PricePoint[]>> {
  const points: Record<PerformanceRange, number> = { '7D': 7, '30D': 30, '90D': 90, ALL: 90 }

  return withCapability(
    platform.portfolioServiceEnabled,
    () => request<PricePoint[]>('/portfolio/performance', { query: { range } }),
    () => [],
    () => demoPortfolio.performance.slice(-points[range]),
  )
}
