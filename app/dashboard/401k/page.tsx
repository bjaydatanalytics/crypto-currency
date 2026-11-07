'use client'

import { useCallback, useEffect, useState } from 'react'
import { PiggyBank } from 'lucide-react'
import { ContractCard } from '@/components/dashboard/contract-card'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { InvestDialog } from '@/components/dashboard/invest-dialog'
import { PlanCard, planCardTerms, type PlanCardTerms } from '@/components/dashboard/plan-card'
import { RetirementSummary } from '@/components/dashboard/retirement-summary'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { listMyInvestments, listPlans, type InvestmentContract } from '@/lib/api/investments'
import type { InvestmentPlan } from '@/lib/types'

interface RetirementPlan {
  plan: InvestmentPlan
  terms: PlanCardTerms
}

/**
 * The 401k page.
 *
 * Retirement plans are a separate catalogue (`category = 'retirement'`), so
 * they never appear in the general plans grid and the general plans never
 * appear here.
 *
 * The positions shown are the customer's contracts against those plans. The
 * API returns every contract, so they are filtered by plan id against the
 * retirement catalogue rather than by name — a renamed plan must not drop its
 * own contracts out of this view.
 */
export default function RetirementPage() {
  const { toast } = useToast()
  const [plans, setPlans] = useState<RetirementPlan[] | null>(null)
  const [contracts, setContracts] = useState<InvestmentContract[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [choosing, setChoosing] = useState<InvestmentPlan | null>(null)

  const load = useCallback(async () => {
    try {
      const [available, mine] = await Promise.all([
        listPlans('retirement'),
        listMyInvestments(),
      ])

      setPlans(
        available
          .map((plan) => ({ plan, terms: planCardTerms(plan) }))
          .filter((entry): entry is RetirementPlan => entry.terms !== null),
      )

      const retirementIds = new Set(available.map((plan) => plan.id))
      setContracts(mine.investments.filter((c) => retirementIds.has(c.planId)))
      setLoadError(null)
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Could not load 401k plans.')
      setPlans([])
      setContracts([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const active = contracts?.filter((contract) => contract.status === 'active') ?? []

  /**
   * Totals are computed from these contracts only, not from the account
   * summary — that figure covers every investment, and this page is about the
   * retirement ones.
   */
  const totalInvest = active.reduce((sum, c) => sum + Number(c.principal), 0)
  const totalProfit = (contracts ?? [])
    .filter((c) => c.status === 'matured')
    .reduce((sum, c) => sum + Number(c.expectedReturn), 0)

  return (
    <>
      <DashboardHeader title="401k" />

      <div className="space-y-5 p-4 sm:p-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">401k Plan</h1>

        <RetirementSummary
          totalInvest={totalInvest}
          totalProfit={totalProfit}
          activeCount={active.length}
          hasPositions={active.length > 0}
        />

        {loadError && (
          <Card className="border-negative/30 bg-negative/[0.05]">
            <CardBody>
              <p className="text-sm font-medium text-negative">Could not load 401k plans</p>
              <p className="mt-1 text-sm leading-relaxed text-ink/75">{loadError}</p>
              <Button variant="secondary" className="mt-4" onClick={() => void load()}>
                Try again
              </Button>
            </CardBody>
          </Card>
        )}

        {active.length > 0 && (
          <ul className="space-y-4">
            {active.map((contract) => (
              <li key={contract.id}>
                <ContractCard contract={contract} />
              </li>
            ))}
          </ul>
        )}

        {/* ---------- The catalogue ---------- */}
        <div id="plans" className="scroll-mt-24 pt-1">
          {plans === null ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-[340px] rounded-xl" />
              ))}
            </div>
          ) : plans.length === 0 ? (
            <EmptyState
              icon={<PiggyBank className="h-5 w-5" aria-hidden="true" />}
              title="No 401k plans are open"
              description="Retirement plans appear here once an operator has published one with a rate, a term and a stated yield source."
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map(({ plan, terms }) => (
                <li key={plan.id} className="flex">
                  <PlanCard plan={plan} terms={terms} onInvest={() => setChoosing(plan)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <InvestDialog
        plan={choosing}
        onClose={() => setChoosing(null)}
        onDone={() => {
          void load()
          toast({
            tone: 'success',
            title: 'Retirement position open',
            description: 'It now appears above, with its exact payout and maturity date.',
          })
        }}
      />
    </>
  )
}
