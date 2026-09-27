'use client'

import Link from 'next/link'
import { Sparkline } from '@/components/charts/sparkline'
import { AssetIcon, ChangePill } from '@/components/ui/asset-icon'
import { Card } from '@/components/ui/card'
import { getAsset } from '@/lib/mock-data'
import type { MarketQuote } from '@/lib/types'
import { formatCompact, formatCurrency } from '@/lib/utils'

/**
 * Market summary card.
 *
 * Prices come from the market service; in this build that is simulated movement
 * from `lib/api/markets.ts`, which is why the grid above it carries a sample-data
 * note rather than the card repeating one each time.
 */
export function MarketCard({ quote, href }: { quote: MarketQuote; href?: string }) {
  const asset = getAsset(quote.assetId)
  const positive = quote.changePercent24h >= 0

  const content = (
    <Card interactive className="h-full p-5">
      <div className="flex items-center gap-3">
        <AssetIcon symbol={quote.symbol} color={asset?.color ?? '#8C9188'} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{quote.name}</p>
          <p className="text-xs uppercase tracking-wider text-muted">{quote.symbol}</p>
        </div>
        <ChangePill value={quote.changePercent24h} />
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="num text-xl font-semibold tracking-tight text-white">
            {formatCurrency(quote.price)}
          </p>
          <p className="mt-1 text-xs text-muted">
            Mkt cap <span className="num">{formatCompact(quote.marketCap)}</span>
          </p>
        </div>
        <Sparkline
          data={quote.sparkline}
          width={104}
          height={40}
          positive={positive}
          className="shrink-0"
        />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 text-xs">
        <div>
          <dt className="text-muted">24h high</dt>
          <dd className="num mt-0.5 text-white/90">{formatCurrency(quote.high24h)}</dd>
        </div>
        <div className="text-right">
          <dt className="text-muted">24h volume</dt>
          <dd className="num mt-0.5 text-white/90">{formatCompact(quote.volume24h)}</dd>
        </div>
      </dl>
    </Card>
  )

  if (!href) return content

  return (
    <Link href={href} className="block h-full rounded-2xl">
      {content}
    </Link>
  )
}
