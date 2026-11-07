'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { emptyAccountSummary, type AccountSummary } from '@/lib/account-summary-types'

/**
 * The account's headline figures, shared by the shell and the dashboard page.
 *
 * Seeded server-side by the dashboard layout, which has already validated the
 * session — so the sidebar renders the real balance on first paint instead of
 * flashing a skeleton or, worse, a zero that looks like an empty account.
 *
 * `refresh()` exists because a layout does not re-render on client-side
 * navigation: without it, a balance would sit unchanged for the whole session
 * after a deposit or withdrawal.
 */

interface SummaryContextValue {
  summary: AccountSummary
  /** True while a refresh is in flight. The stale figure stays on screen. */
  refreshing: boolean
  refresh: () => Promise<void>
}

const SummaryContext = createContext<SummaryContextValue>({
  summary: emptyAccountSummary(),
  refreshing: false,
  refresh: async () => {},
})

export function SummaryProvider({
  initial,
  children,
}: {
  initial: AccountSummary
  children: React.ReactNode
}) {
  const [summary, setSummary] = useState(initial)
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const response = await fetch('/api/account/summary', { cache: 'no-store' })
      if (!response.ok) return
      setSummary((await response.json()) as AccountSummary)
    } catch {
      /**
       * Keep the figure already on screen. Replacing a real balance with zero
       * because the network blipped would be a false statement about money.
       */
    } finally {
      setRefreshing(false)
    }
  }, [])

  const value = useMemo(
    () => ({ summary, refreshing, refresh }),
    [summary, refreshing, refresh],
  )

  return <SummaryContext.Provider value={value}>{children}</SummaryContext.Provider>
}

export function useSummary(): SummaryContextValue {
  return useContext(SummaryContext)
}
