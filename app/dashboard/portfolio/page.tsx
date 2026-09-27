'use client'

import { useEffect, useState } from 'react'
import { Landmark, PiggyBank, TrendingUp, Wallet } from 'lucide-react'
import { AllocationDonut } from '@/components/charts/allocation-donut'
import { PerformanceAreaChart } from '@/components/charts/area-chart'
import { VolumeBarChart } from '@/components/charts/bar-chart'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { HoldingsTable } from '@/components/dashboard/holdings-table'
import { StatCard } from '@/components/dashboard/stat-card'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { DemoNotice } from '@/components/ui/demo-notice'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs } from '@/components/ui/tabs'
import { fetchPerformance, fetchPortfolio, type PerformanceRange } from '@/lib/api/portfolio'
import { listQuotes } from '@/lib/api/markets'
import type { MarketQuote, Portfolio, PricePoint } from '@/lib/types'
import { formatCurrency, formatPercent } from '@/lib/utils'

const ranges: PerformanceRange[] = ['7D', '30D', '90D', 'ALL']

export default function PortfolioPage() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [performance, setPerformance] = useState<PricePoint[] | null>(null)
  const [range, setRange] = useState<PerformanceRange>('30D')
  const [quotes, setQuotes] = useState<MarketQuote[]>([])

  useEffect(() => {
    let active = true
    fetchPortfolio().then(({ data }) => active && setPortfolio(data))
    listQuotes().then(({ data }) => active && setQuotes(data))
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    setPerformance(null)
    fetchPerformance(range).then(({ data }) => active && setPerformance(data))
    return () => {
      active = false
    }
  }, [range])

  /** 24h movement per market, as a comparison bar chart. */
  const marketMovement: PricePoint[] = quotes.map((quote) => ({
    time: quote.symbol,
    value: Number(quote.changePercent24h.toFixed(2)),
  }))

  return (
    <>
      <DashboardHeader title="Portfolio" />

      <div className="space-y-6 p-4 sm:p-6">
        <DemoNotice />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {portfolio ? (
            <>
              <StatCard
                label="Total value"
                value={formatCurrency(portfolio.totalValue)}
                delta={portfolio.changePercent24h}
                deltaLabel="24h"
                icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
              />
              <StatCard
                label="24h change"
                value={formatCurrency(portfolio.change24h)}
                delta={portfolio.changePercent24h}
                icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
              />
              <StatCard
                label="Available balance"
                value={formatCurrency(portfolio.availableBalance)}
                icon={<Landmark className="h-4 w-4" aria-hidden="true" />}
              />
              <StatCard
                label="Invested"
                value={formatCurrency(portfolio.investedAmount)}
                icon={<PiggyBank className="h-4 w-4" aria-hidden="true" />}
              />
            </>
          ) : (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[126px]" />)
          )}
        </div>

        <Card>
          <CardHeader className="flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div>
              <CardTitle>Performance</CardTitle>
              <p className="mt-1 text-sm text-muted">Sample portfolio value over time</p>
            </div>
            <Tabs
              items={ranges.map((r) => ({ value: r, label: r }))}
              value={range}
              onChange={(value) => setRange(value as PerformanceRange)}
              size="sm"
              className="sm:ml-auto"
            />
          </CardHeader>
          <CardBody className="px-2 sm:px-4">
            {performance ? (
              <PerformanceAreaChart
                data={performance}
                height={320}
                ariaLabel={`Sample portfolio value over the last ${range}`}
              />
            ) : (
              <Skeleton className="h-[320px] w-full rounded-xl" />
            )}
          </CardBody>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Asset allocation</CardTitle>
            </CardHeader>
            <CardBody>
              {portfolio ? (
                <AllocationDonut holdings={portfolio.holdings} height={260} />
              ) : (
                <Skeleton className="h-[260px] w-full rounded-xl" />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Market performance</CardTitle>
              <p className="text-sm text-muted">24h movement</p>
            </CardHeader>
            <CardBody className="px-2 sm:px-4">
              {marketMovement.length > 0 ? (
                <VolumeBarChart
                  data={marketMovement}
                  height={260}
                  ariaLabel="Sample 24 hour percentage movement by market"
                  valueFormatter={(v) => formatPercent(v)}
                  labelFormatter={(label) => label}
                />
              ) : (
                <Skeleton className="h-[260px] w-full rounded-xl" />
              )}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Holdings</CardTitle>
          </CardHeader>
          <CardBody className="p-4 sm:p-0">
            {portfolio ? (
              <HoldingsTable holdings={portfolio.holdings} />
            ) : (
              <Skeleton className="h-64 w-full" />
            )}
          </CardBody>
        </Card>
      </div>
    </>
  )
}
