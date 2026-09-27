'use client'

import { useEffect, useState } from 'react'
import { RevealGroup, RevealItem } from '@/components/ui/reveal'
import { SkeletonCard } from '@/components/ui/skeleton'
import { listQuotes, subscribeToQuotes } from '@/lib/api/markets'
import type { MarketQuote } from '@/lib/types'
import { MarketCard } from './market-card'

/**
 * Market grid wired to the market service.
 *
 * The component knows nothing about where quotes come from — it calls
 * `listQuotes()` and subscribes to updates. Point the service at a real feed
 * and this renders live prices with no change here.
 */
export function MarketGrid({
  symbols,
  live = true,
  className,
}: {
  symbols?: string[]
  live?: boolean
  className?: string
}) {
  const [quotes, setQuotes] = useState<MarketQuote[] | null>(null)

  useEffect(() => {
    let active = true

    listQuotes().then(({ data }) => {
      if (active) setQuotes(data)
    })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!live || !quotes) return
    return subscribeToQuotes((next) => setQuotes(next))
    // Subscribe once the first payload has arrived; `quotes` intentionally
    // omitted from deps so updates don't tear down the subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, quotes !== null])

  if (!quotes) {
    return (
      <div className={className}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: symbols?.length ?? 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  const visible = symbols
    ? symbols
        .map((symbol) => quotes.find((q) => q.symbol === symbol))
        .filter((q): q is MarketQuote => Boolean(q))
    : quotes

  return (
    <RevealGroup className={className}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((quote) => (
          <RevealItem key={quote.symbol}>
            <MarketCard quote={quote} href={`/dashboard/trade?symbol=${quote.symbol}`} />
          </RevealItem>
        ))}
      </div>
    </RevealGroup>
  )
}
