/**
 * Trading service.
 *
 * Orders placed through this prototype are DEMO ONLY: nothing is routed to a
 * venue and no position is opened. `executed` is false whenever the platform
 * runs in demo mode, and the UI must surface that message verbatim rather than
 * showing a success state of its own.
 */

import { platform } from '../config'
import type { ApiResult, OrderRequest, OrderResult } from '../types'
import { request, withFallback } from './client'

export async function placeOrder(order: OrderRequest): Promise<ApiResult<OrderResult>> {
  return withFallback(
    () => request<OrderResult>('/orders', { method: 'POST', body: order }),
    () => ({
      executed: false,
      demo: platform.demoMode,
      message:
        'Demo order recorded locally. No order was sent to any venue, no position was opened and no funds moved.',
      order: {
        ...order,
        // Local reference for the demo confirmation panel only — not an order ID.
        id: `demo-${Date.now().toString(36)}`,
        createdAt: new Date().toISOString(),
      },
    }),
    450,
  )
}

/** Fee preview. Real schedules must come from the backend. */
/** Null rates mean "not configured yet" — never render them as zero. */
interface FeeEstimate {
  feeRate: number | null
  feeAmount: number | null
  demo: boolean
}

export async function estimateFees(order: OrderRequest): Promise<ApiResult<FeeEstimate>> {
  return withFallback(
    () =>
      request<FeeEstimate>('/orders/estimate', {
        method: 'POST',
        body: order,
      }),
    () => ({ feeRate: null, feeAmount: null, demo: true }),
    200,
  )
}
