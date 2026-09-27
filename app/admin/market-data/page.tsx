'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { AdminNotice } from '@/components/admin/admin-notice'
import { AdminShell } from '@/components/admin/admin-shell'
import { AssetIcon, ChangePill } from '@/components/ui/asset-icon'
import { Badge } from '@/components/ui/badge'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { PendingInfo } from '@/components/ui/demo-notice'
import { SkeletonRows } from '@/components/ui/skeleton'
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table'
import { listQuotes } from '@/lib/api/markets'
import { platform } from '@/lib/config'
import { getAsset } from '@/lib/mock-data'
import type { MarketQuote } from '@/lib/types'
import { formatCompact, formatCurrency, relativeTime } from '@/lib/utils'

export default function AdminMarketDataPage() {
  const [quotes, setQuotes] = useState<MarketQuote[] | null>(null)

  useEffect(() => {
    let active = true
    listQuotes().then(({ data }) => active && setQuotes(data))
    return () => {
      active = false
    }
  }, [])

  // The provider key lives server-side, so the client only learns whether live
  // data is switched on — never the key itself.
  const connected = platform.liveMarketData

  return (
    <AdminShell data="live" title="Market data" description="Feed status and supported assets">
      <div className="space-y-6">
        <AdminNotice />

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Feed status</CardTitle>
              <p className="mt-1 text-sm text-muted">Where prices in the product come from</p>
            </div>
            <Badge tone={connected ? 'success' : 'warn'} dot>
              {connected ? 'Provider configured' : 'Mock feed'}
            </Badge>
          </CardHeader>
          <CardBody>
            <dl className="grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted">Provider</dt>
                <dd className="mt-1.5 text-sm text-white">
                  {connected ? 'Configured server-side' : 'None — simulated'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted">Update mechanism</dt>
                <dd className="mt-1.5 text-sm text-white">
                  {connected ? 'Configured endpoint' : 'Timer-based simulation (5s)'}
                </dd>
              </div>
            </dl>

            <div className="mt-6 rounded-xl border border-line bg-base-800 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-white">
                <RefreshCw className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                Connecting a real feed
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Set <code className="text-white/80">NEXT_PUBLIC_MARKET_API_URL</code> and implement
                the live branch of each function in{' '}
                <code className="text-white/80">lib/api/markets.ts</code>. The response must satisfy{' '}
                <code className="text-white/80">MarketQuote</code> and{' '}
                <code className="text-white/80">Candle</code>; no component reads prices directly,
                so nothing else changes.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <PendingInfo label="Market data provider and licence terms" />
                <PendingInfo label="Attribution required by the provider" />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Supported assets</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {!quotes ? (
              <div className="p-5">
                <SkeletonRows rows={6} />
              </div>
            ) : (
              <TableWrap>
                <Table className="min-w-[720px]">
                  <Thead>
                    <Tr>
                      <Th>Asset</Th>
                      <Th>Network</Th>
                      <Th numeric>Price</Th>
                      <Th numeric>24h</Th>
                      <Th numeric>Volume</Th>
                      <Th>Updated</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {quotes.map((quote) => {
                      const asset = getAsset(quote.assetId)
                      return (
                        <Tr key={quote.symbol} interactive>
                          <Td>
                            <span className="flex items-center gap-3">
                              <AssetIcon
                                symbol={quote.symbol}
                                color={asset?.color ?? '#8C9188'}
                                size="sm"
                              />
                              <span>
                                <span className="block font-medium text-white">{quote.name}</span>
                                <span className="block text-xs text-muted">{quote.symbol}</span>
                              </span>
                            </span>
                          </Td>
                          <Td className="text-muted">{asset?.network ?? '—'}</Td>
                          <Td numeric>{formatCurrency(quote.price)}</Td>
                          <Td numeric>
                            <ChangePill value={quote.changePercent24h} />
                          </Td>
                          <Td numeric>{formatCompact(quote.volume24h)}</Td>
                          <Td className="text-muted">{relativeTime(quote.updatedAt)}</Td>
                        </Tr>
                      )
                    })}
                  </Tbody>
                </Table>
              </TableWrap>
            )}
          </CardBody>
        </Card>
      </div>
    </AdminShell>
  )
}
