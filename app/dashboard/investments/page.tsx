'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, Lock, Plus, TrendingUp } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { InvestDialog } from '@/components/dashboard/invest-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Select } from '@/components/ui/select'
import { SkeletonRows } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import {
  listMyInvestments,
  listPlans,
  type InvestmentContract,
  type InvestmentState,
} from '@/lib/api/investments'
import type { InvestmentPlan } from '@/lib/types'
import { formatDate } from '@/lib/utils'

const STATE_TONES: Record<InvestmentState, 'accent' | 'success' | 'neutral'> = {
  active: 'accent',
  matured: 'success',
  cancelled: 'neutral',
}

const FILTERS = [
  { value: 'all', label: 'All contracts' },
  { value: 'active', label: 'Active' },
  { value: 'matured', label: 'Matured' },
  { value: 'cancelled', label: 'Cancelled' },
]

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback
}

function trimZeros(value: string): string {
  return value.includes('.') ? value.replace(/\.?0+$/, '') : value
}

function describeRate(plan: InvestmentPlan): string | null {
  if (plan.fixedRatePercent === null || plan.fixedRatePercent === undefined) return null
  return plan.rateBasis === 'annual'
    ? `${plan.fixedRatePercent}% a year`
    : `${plan.fixedRatePercent}% over the term`
}

/**
 * The customer's investments.
 *
 * Every amount is rendered from the contract's own frozen terms, never
 * recomputed from the plan — a plan an operator edits tomorrow must not change
 * what this screen says somebody is owed today.
 */
export default function InvestmentsPage() {
  const { toast } = useToast()
  const [contracts, setContracts] = useState<InvestmentContract[] | null>(null)
  const [plans, setPlans] = useState<InvestmentPlan[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [choosing, setChoosing] = useState<InvestmentPlan | null>(null)

  const load = useCallback(async () => {
    try {
      const [mine, available] = await Promise.all([
        listMyInvestments(filter === 'all' ? undefined : (filter as InvestmentState)),
        listPlans(),
      ])
      setContracts(mine.investments)
      // Only plans that actually promise a return can be subscribed to.
      setPlans(
        available.filter(
          (plan) =>
            plan.fixedRatePercent !== null &&
            plan.fixedRatePercent !== undefined &&
            Boolean(plan.duration),
        ),
      )
      setLoadError(null)
    } catch (cause) {
      setLoadError(errorMessage(cause, 'Could not load your investments.'))
      setContracts([])
    }
  }, [filter])

  useEffect(() => {
    setContracts(null)
    void load()
  }, [load])

  if (loadError) {
    return (
      <>
        <DashboardHeader title="Investments" />
        <div className="p-4 sm:p-6">
          <Card className="border-negative/30 bg-negative/[0.05]">
            <CardBody>
              <p className="text-sm font-medium text-negative">Could not load your investments</p>
              <p className="mt-1 text-sm leading-relaxed text-white/75">{loadError}</p>
              <Button variant="secondary" className="mt-4" onClick={() => void load()}>
                Try again
              </Button>
            </CardBody>
          </Card>
        </div>
      </>
    )
  }

  const active = contracts?.filter((contract) => contract.status === 'active') ?? []

  return (
    <>
      <DashboardHeader title="Investments" />

      <div className="space-y-6 p-4 sm:p-6">
        {/* ---------- Open a contract ---------- */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Open an investment</CardTitle>
              <p className="mt-1 text-xs text-muted">
                Funds are locked for the full term, with no early exit
              </p>
            </div>
          </CardHeader>
          <CardBody>
            {plans === null ? (
              <SkeletonRows rows={2} />
            ) : plans.length === 0 ? (
              <p className="text-sm leading-relaxed text-muted">
                No investment plans are open at the moment. Published plans appear here once an
                operator has set a rate and a term.
              </p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {plans.map((plan) => (
                  <li key={plan.id}>
                    <Card className="flex h-full flex-col p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-white">{plan.name}</h3>
                        {plan.popular && <Badge tone="accent">Most chosen</Badge>}
                      </div>
                      <p className="mt-1.5 text-lg font-semibold text-accent">
                        {describeRate(plan)}
                      </p>
                      <p className="num mt-0.5 text-xs text-muted">
                        {plan.duration} day term
                        {plan.minimumAmount !== null &&
                          ` · from ${plan.minimumAmount} ${plan.currency}`}
                      </p>
                      <p className="mt-3 flex-1 text-xs leading-relaxed text-muted">
                        {plan.summary}
                      </p>
                      <Button size="sm" className="mt-4" onClick={() => setChoosing(plan)}>
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        Invest
                      </Button>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* ---------- Locked summary ---------- */}
        {active.length > 0 && (
          <Card className="border-accent/25 bg-accent/[0.04]">
            <CardBody className="flex items-start gap-3">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-white/80">
                You have {active.length} active contract{active.length === 1 ? '' : 's'}. Those
                funds are locked and cannot be withdrawn until each term ends.
              </p>
            </CardBody>
          </Card>
        )}

        {/* ---------- Contracts ---------- */}
        <Card>
          <CardHeader className="flex-col items-start gap-4 sm:flex-row sm:items-center">
            <CardTitle>Your contracts</CardTitle>
            <div className="w-full sm:ml-auto sm:w-44">
              <Select
                aria-label="Filter contracts"
                options={FILTERS}
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              />
            </div>
          </CardHeader>
          <CardBody>
            {contracts === null ? (
              <SkeletonRows rows={3} />
            ) : contracts.length === 0 ? (
              <EmptyState
                icon={<TrendingUp className="h-5 w-5" />}
                title="No contracts yet"
                description="Open one above. Nothing here is a projection — each contract shows exactly what is owed and when."
                className="border-0"
              />
            ) : (
              <ul className="space-y-4">
                {contracts.map((contract) => (
                  <li key={contract.id}>
                    <Card className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold text-white">
                            {contract.planName}
                          </h3>
                          <p className="num mt-0.5 text-xs text-muted">
                            {contract.fixedRatePercent}%{' '}
                            {contract.rateBasis === 'annual' ? 'a year' : 'over the term'} ·{' '}
                            {contract.durationDays} days
                          </p>
                        </div>
                        <Badge tone={STATE_TONES[contract.status]}>{contract.status}</Badge>
                      </div>

                      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm sm:grid-cols-4">
                        <div>
                          <dt className="text-xs uppercase tracking-wider text-muted">
                            {contract.status === 'active' ? 'Locked' : 'Principal'}
                          </dt>
                          <dd className="num mt-1 text-white">
                            {trimZeros(contract.principal)} {contract.assetSymbol}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wider text-muted">
                            {contract.status === 'matured' ? 'Return paid' : 'Return owed'}
                          </dt>
                          <dd className="num mt-1 text-accent">
                            {contract.status === 'cancelled'
                              ? '—'
                              : `${trimZeros(contract.expectedReturn)} ${contract.assetSymbol}`}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wider text-muted">Started</dt>
                          <dd className="num mt-1 text-white/90">
                            {formatDate(contract.startedAt)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wider text-muted">
                            {contract.status === 'active' ? 'Matures' : 'Ended'}
                          </dt>
                          <dd className="num mt-1 text-white/90">
                            {formatDate(
                              contract.maturedAt ?? contract.cancelledAt ?? contract.maturesAt,
                            )}
                          </dd>
                        </div>
                      </dl>

                      {contract.status === 'active' && (
                        <p className="mt-4 flex items-center gap-2 text-xs text-muted">
                          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                          {contract.daysRemaining === 0
                            ? 'Term complete — awaiting payout'
                            : `${contract.daysRemaining} day${contract.daysRemaining === 1 ? '' : 's'} remaining`}
                        </p>
                      )}

                      {contract.status === 'cancelled' && contract.cancellationReason && (
                        <p className="mt-4 rounded-lg border border-line bg-white/[0.02] p-3 text-xs leading-relaxed text-muted">
                          Cancelled: {contract.cancellationReason}. Your principal was returned in
                          full and no return was paid.
                        </p>
                      )}
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <InvestDialog
        plan={choosing}
        onClose={() => setChoosing(null)}
        onDone={() => {
          void load()
          toast({
            tone: 'success',
            title: 'Contract open',
            description: 'It appears below, with the exact payout and date.',
          })
        }}
      />
    </>
  )
}
