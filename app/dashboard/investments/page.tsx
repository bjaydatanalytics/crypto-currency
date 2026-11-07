'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Frown } from 'lucide-react'
import { ContractCard } from '@/components/dashboard/contract-card'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { useSummary } from '@/components/dashboard/summary-provider'
import { Button, ButtonLink } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { SkeletonRows } from '@/components/ui/skeleton'
import { listMyInvestments, type InvestmentContract, type InvestmentState } from '@/lib/api/investments'
import { cn, formatMoney } from '@/lib/utils'

const FILTERS = [
  { value: 'all', label: 'All contracts' },
  { value: 'active', label: 'Active' },
  { value: 'matured', label: 'Matured' },
  { value: 'cancelled', label: 'Cancelled' },
]

/* ------------------------------------------------------------------ */

/** A headline figure in the summary card. */
function Figure({
  label,
  value,
  align = 'left',
}: {
  label: string
  value: number
  align?: 'left' | 'right'
}) {
  const right = align === 'right'

  return (
    <div className={right ? 'text-right' : undefined}>
      <p className="text-[13px] text-muted">{label}</p>
      <p
        className={cn(
          'mt-1 flex items-baseline gap-1 text-accent',
          right && 'justify-end',
        )}
      >
        <span className="text-sm font-medium">$</span>
        <span className="num text-2xl font-bold tracking-tight">{formatMoney(value)}</span>
      </p>
    </div>
  )
}

/** The bordered "nothing here" panel the design uses in place of a table. */
function BlankPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[150px] items-center justify-center rounded-xl border border-line bg-surface p-6 text-center shadow-card">
      <p className="text-xl font-bold tracking-tight text-ink/80">{children}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */

/**
 * All Investment — the customer's own positions.
 *
 * The plan catalogue lives on its own page; this one answers "what do I have
 * and what is it worth". Totals come from the shared account summary, so the
 * figure here and the one in the sidebar are always the same number.
 */
export default function AllInvestmentPage() {
  const { summary } = useSummary()
  const [contracts, setContracts] = useState<InvestmentContract[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')

  const load = useCallback(async () => {
    try {
      const mine = await listMyInvestments(filter === 'all' ? undefined : (filter as InvestmentState))
      setContracts(mine.investments)
      setLoadError(null)
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Could not load your investments.')
      setContracts([])
    }
  }, [filter])

  useEffect(() => {
    setContracts(null)
    void load()
  }, [load])

  const active = contracts?.filter((contract) => contract.status === 'active') ?? []

  return (
    <>
      <DashboardHeader title="Investments" />

      <div className="space-y-5 p-4 sm:p-6">
        <div>
          <p className="text-[13px] text-muted">Investment</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-ink">All Investment</h1>
        </div>

        {/* ---------- Totals + actions, beside the headline state ---------- */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <Figure label="Total Invest" value={summary.investments.total.usd} />
              <Figure label="Total Profit" value={summary.investments.interests.usd} align="right" />
            </div>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <ButtonLink href="/dashboard/investments/plans" size="sm">
                Invest Now
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="/dashboard/withdrawals" variant="navy" size="sm">
                Withdraw Now
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </ButtonLink>
            </div>
          </Card>

          {contracts === null ? (
            <Card className="p-5">
              <SkeletonRows rows={2} />
            </Card>
          ) : contracts.length === 0 ? (
            <BlankPanel>No Investment Found Yet</BlankPanel>
          ) : (
            <Card className="flex flex-col justify-center p-5 shadow-card">
              <p className="num text-2xl font-bold tracking-tight text-ink">
                {contracts.length}
              </p>
              <p className="mt-1 text-[13px] text-muted">
                {contracts.length === 1 ? 'contract' : 'contracts'} on this filter ·{' '}
                {active.length} still running
              </p>
            </Card>
          )}
        </div>

        {loadError && (
          <Card className="border-negative/30 bg-negative/[0.05]">
            <CardBody>
              <p className="text-sm font-medium text-negative">Could not load your investments</p>
              <p className="mt-1 text-sm leading-relaxed text-ink/75">{loadError}</p>
              <Button variant="secondary" className="mt-4" onClick={() => void load()}>
                Try again
              </Button>
            </CardBody>
          </Card>
        )}

        {/* ---------- Active plans ---------- */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight text-ink">
            Active Plan ({active.length})
          </h2>
          <Link
            href="/dashboard/transactions"
            className="group inline-flex items-center gap-1.5 text-[13px] text-accent transition-colors hover:text-accent-bright"
          >
            Investment Logs
            <ArrowRight
              className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>

        {contracts === null ? (
          <SkeletonRows rows={2} />
        ) : active.length === 0 ? (
          <div className="inline-flex items-center gap-2.5 rounded-xl border border-line bg-surface px-6 py-5 shadow-card">
            <Frown className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
            <p className="text-lg font-bold tracking-tight text-ink/80">Data not found</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {active.map((contract) => (
              <li key={contract.id}>
                <ContractCard contract={contract} />
              </li>
            ))}
          </ul>
        )}

        {/* ---------- Full history ---------- */}
        {contracts !== null && contracts.length > 0 && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <h2 className="text-lg font-bold tracking-tight text-ink">Contract history</h2>
              <div className="w-full sm:w-44">
                <Select
                  aria-label="Filter contracts"
                  options={FILTERS}
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                />
              </div>
            </div>

            <ul className="space-y-4">
              {contracts.map((contract) => (
                <li key={contract.id}>
                  <ContractCard contract={contract} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  )
}
