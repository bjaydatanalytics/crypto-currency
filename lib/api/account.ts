/**
 * Account summary — the figures the customer dashboard leads with.
 *
 * Deliberately has no mock fallback. These are balances: a sample figure here
 * would tell someone they hold money they do not hold. When no backend is
 * configured the honest answer is a zeroed summary, which `emptyAccountSummary`
 * provides, flagged by `isMock: false` because zero is not a simulation — it is
 * what an account with no backing data actually contains.
 */

import { emptyAccountSummary, type AccountSummary } from '../account-summary-types'
import { isBackendConfigured, request } from './client'

export type { AccountSummary, MoneyTotal, MovementTotals } from '../account-summary-types'

export async function fetchAccountSummary(): Promise<AccountSummary> {
  if (!isBackendConfigured()) return emptyAccountSummary()
  return request<AccountSummary>('/account/summary')
}
