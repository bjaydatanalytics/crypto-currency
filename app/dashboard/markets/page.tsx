'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Sparkline } from '@/components/charts/sparkline'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { AssetIcon, ChangePill } from '@/components/ui/asset-icon'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { DemoNotice } from '@/components/ui/demo-notice'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { SkeletonRows } from '@/components/ui/skeleton'
import {
  MobileCard,
  MobileCardList,
  MobileRow,
  Table,
  TableWrap,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@/components/ui/table'
import { listQuotes, subscribeToQuotes } from '@/lib/api/markets'
import { getAsset } from '@/lib/mock-data'
import type { MarketQuote } from '@/lib/types'
import { formatCompact, formatCurrency } from '@/lib/utils'

export default function DashboardMarketsPage() {
  const [quotes, setQuotes] = useState<MarketQuote[] | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let active = true
    listQuotes().then(({ data }) => active && setQuotes(data))
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!quotes) return
    return subscribeToQuotes(setQuotes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotes !== null])

  const filtered = useMemo(() => {
    if (!quotes) return null
    const term = search.trim().toLowerCase()
    if (!term) return quotes
    return quotes.filter(
      (q) => q.name.toLowerCase().includes(term) || q.symbol.toLowerCase().includes(term),
    )
  }, [quotes, search])

  return (
    <>
      <DashboardHeader title="Markets" />

      <div className="space-y-6 p-4 sm:p-6">
        <DemoNotice title="Simulated prices">
          Prices update on a timer to demonstrate the interface. They are not live market rates.
        </DemoNotice>

        <Card>
          <CardHeader className="flex-col items-start gap-4 sm:flex-row sm:items-center">
            <CardTitle>All markets</CardTitle>
            <div className="w-full sm:ml-auto sm:max-w-xs">
              <Input
                type="search"
                placeholder="Search assets"
                aria-label="Search markets"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search className="h-4 w-4" />}
              />
            </div>
          </CardHeader>

          <CardBody className="p-4 sm:p-0">
            {!filtered ? (
              <div className="p-2 sm:p-5">
                <SkeletonRows rows={6} />
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<Search className="h-5 w-5" />}
                title="No markets found"
                description={`Nothing matches “${search}”. Try a different symbol or name.`}
                className="m-2 border-0 sm:m-5"
              />
            ) : (
              <>
                <TableWrap className="hidden sm:block">
                  <Table className="min-w-[760px]">
                    <Thead>
                      <Tr>
                        <Th>Asset</Th>
                        <Th numeric>Price</Th>
                        <Th numeric>24h</Th>
                        <Th numeric>24h volume</Th>
                        <Th numeric>Market cap</Th>
                        <Th>Last 24h</Th>
                        <Th numeric>Trade</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {filtered.map((quote) => (
                        <Tr key={quote.symbol} interactive>
                          <Td>
                            <div className="flex items-center gap-3">
                              <AssetIcon
                                symbol={quote.symbol}
                                color={getAsset(quote.assetId)?.color ?? '#8C9188'}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <p className="truncate font-medium text-white">{quote.name}</p>
                                <p className="text-xs text-muted">{quote.symbol}</p>
                              </div>
                            </div>
                          </Td>
                          <Td numeric>{formatCurrency(quote.price)}</Td>
                          <Td numeric>
                            <ChangePill value={quote.changePercent24h} />
                          </Td>
                          <Td numeric>{formatCompact(quote.volume24h)}</Td>
                          <Td numeric>{formatCompact(quote.marketCap)}</Td>
                          <Td>
                            <Sparkline
                              data={quote.sparkline}
                              width={100}
                              height={32}
                              positive={quote.changePercent24h >= 0}
                            />
                          </Td>
                          <Td numeric>
                            <Link
                              href={`/dashboard/trade?symbol=${quote.symbol}`}
                              className="text-sm text-accent transition-colors hover:text-accent-bright"
                            >
                              Trade
                            </Link>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableWrap>

                <MobileCardList className="sm:hidden">
                  {filtered.map((quote) => (
                    <MobileCard key={quote.symbol}>
                      <div className="flex items-center gap-3">
                        <AssetIcon
                          symbol={quote.symbol}
                          color={getAsset(quote.assetId)?.color ?? '#8C9188'}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">{quote.name}</p>
                          <p className="num text-xs text-muted">{formatCurrency(quote.price)}</p>
                        </div>
                        <ChangePill value={quote.changePercent24h} />
                      </div>

                      <div className="mt-3 divide-y divide-line border-t border-line pt-1">
                        <MobileRow
                          label="24h volume"
                          value={<span className="num">{formatCompact(quote.volume24h)}</span>}
                        />
                        <MobileRow
                          label="Market cap"
                          value={<span className="num">{formatCompact(quote.marketCap)}</span>}
                        />
                      </div>

                      <Link
                        href={`/dashboard/trade?symbol=${quote.symbol}`}
                        className="mt-3 flex min-h-[40px] items-center justify-center rounded-lg border border-accent/30 text-sm font-medium text-accent transition-colors hover:bg-accent/10"
                      >
                        Trade {quote.symbol}
                      </Link>
                    </MobileCard>
                  ))}
                </MobileCardList>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  )
}
