'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Landmark, PiggyBank, TrendingUp, Wallet } from 'lucide-react'
import { AllocationDonut } from '@/components/charts/allocation-donut'
import { PerformanceAreaChart } from '@/components/charts/area-chart'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { HoldingsTable } from '@/components/dashboard/holdings-table'
import { StatCard } from '@/components/dashboard/stat-card'
import { TransactionsTable } from '@/components/dashboard/transactions-table'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { DemoNotice } from '@/components/ui/demo-notice'
import { Skeleton, SkeletonRows } from '@/components/ui/skeleton'
import { Tabs } from '@/components/ui/tabs'
import { fetchPortfolio, fetchPerformance, type PerformanceRange } from '@/lib/api/portfolio'
import { listTransactions } from '@/lib/api/transactions'
import type { Portfolio, PricePoint, Transaction } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

const ranges: PerformanceRange[] = ['7D', '30D', '90D']

export default function DashboardPage() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [performance, setPerformance] = useState<PricePoint[] | null>(null)
  const [range, setRange] = useState<PerformanceRange>('30D')
  const [transactions, setTransactions] = useState<Transaction[] | null>(null)

  useEffect(() => {
    let active = true
    fetchPortfolio().then(({ data }) => active && setPortfolio(data))
    listTransactions({ pageSize: 5 }).then(({ data }) => active && setTransactions(data.items))
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

  return (
    <>
      <DashboardHeader title="Dashboard" />

      <div className="space-y-6 p-4 sm:p-6">
        <DemoNotice>
          This dashboard runs on sample data. The portfolio, balances and transactions below are
          generated for demonstration and do not represent a real account or real market activity.
        </DemoNotice>

        {/* ---------- Headline figures ---------- */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {portfolio ? (
            <>
              <StatCard
                label="Total portfolio value"
                value={formatCurrency(portfolio.totalValue)}
                delta={portfolio.changePercent24h}
                deltaLabel="24h"
                icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
                info="The combined value of every asset you hold, priced at the latest sample rate."
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
                info="Funds not currently allocated to a position or plan."
              />
              <StatCard
                label="Invested amount"
                value={formatCurrency(portfolio.investedAmount)}
                icon={<PiggyBank className="h-4 w-4" aria-hidden="true" />}
              />
            </>
          ) : (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-4 h-7 w-32" />
                <Skeleton className="mt-3 h-3 w-16" />
              </Card>
            ))
          )}
        </div>

        {/* ---------- Performance + allocation ---------- */}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader className="flex-col items-start gap-4 sm:flex-row sm:items-center">
              <div>
                <CardTitle>Portfolio performance</CardTitle>
                <p className="mt-1 text-sm text-muted">Sample value over time</p>
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
                  height={300}
                  ariaLabel={`Sample portfolio value over the last ${range}`}
                />
              ) : (
                <Skeleton className="h-[300px] w-full rounded-xl" />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Asset allocation</CardTitle>
            </CardHeader>
            <CardBody>
              {portfolio ? (
                <AllocationDonut holdings={portfolio.holdings} height={240} />
              ) : (
                <Skeleton className="h-[240px] w-full rounded-xl" />
              )}
            </CardBody>
          </Card>
        </div>

        {/* ---------- Holdings ---------- */}
        <Card>
          <CardHeader>
            <CardTitle>Your assets</CardTitle>
            <Link
              href="/dashboard/portfolio"
              className="group inline-flex shrink-0 items-center gap-1.5 text-sm text-accent transition-colors hover:text-accent-bright"
            >
              View portfolio
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </CardHeader>
          <CardBody className="p-0 sm:p-0">
            <div className="p-4 sm:p-0">
              {portfolio ? (
                <HoldingsTable holdings={portfolio.holdings} />
              ) : (
                <div className="p-5">
                  <SkeletonRows />
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* ---------- Recent activity ---------- */}
        <Card>
          <CardHeader>
            <CardTitle>Recent transactions</CardTitle>
            <Link
              href="/dashboard/transactions"
              className="group inline-flex shrink-0 items-center gap-1.5 text-sm text-accent transition-colors hover:text-accent-bright"
            >
              View all
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </CardHeader>
          <CardBody className="p-0 sm:p-0">
            <div className="p-4 sm:p-0">
              {transactions ? (
                <TransactionsTable transactions={transactions} />
              ) : (
                <div className="p-5">
                  <SkeletonRows />
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  )
}
