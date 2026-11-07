'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, TrendingUp } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { InvestDialog } from '@/components/dashboard/invest-dialog'
import { PlanCard, planCardTerms, type PlanCardTerms } from '@/components/dashboard/plan-card'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { listPlans } from '@/lib/api/investments'
import type { InvestmentPlan } from '@/lib/types'

/** A plan paired with the figures its card needs, so neither is recomputed. */
interface InvestablePlan {
  plan: InvestmentPlan
  terms: PlanCardTerms
}

/**
 * The investment plans a customer can subscribe to.
 *
 * Only plans that promise a rate over a term appear. `planCardTerms` returns
 * null for anything else, and those are dropped rather than rendered with a
 * blank or zero rate — a card showing "0.00%" reads as a real offer of nothing.
 */
export default function InvestmentPlansPage() {
  const { toast } = useToast()
  const [plans, setPlans] = useState<InvestablePlan[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [choosing, setChoosing] = useState<InvestmentPlan | null>(null)

  const load = useCallback(async () => {
    try {
      const available = await listPlans()
      setPlans(
        available
          .map((plan) => ({ plan, terms: planCardTerms(plan) }))
          .filter((entry): entry is InvestablePlan => entry.terms !== null),
      )
      setLoadError(null)
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Could not load investment plans.')
      setPlans([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <>
      <DashboardHeader title="Investment Plans" />

      <div className="space-y-5 p-4 sm:p-6">
        <div>
          <Link
            href="/dashboard/investments"
            className="inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-accent"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            All Investment
          </Link>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-ink">Investment Plans</h1>
        </div>

        {loadError ? (
          <Card className="border-negative/30 bg-negative/[0.05]">
            <CardBody>
              <p className="text-sm font-medium text-negative">Could not load investment plans</p>
              <p className="mt-1 text-sm leading-relaxed text-ink/75">{loadError}</p>
              <Button variant="secondary" className="mt-4" onClick={() => void load()}>
                Try again
              </Button>
            </CardBody>
          </Card>
        ) : plans === null ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[340px] rounded-xl" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <EmptyState
            icon={<TrendingUp className="h-5 w-5" aria-hidden="true" />}
            title="No investment plans are open"
            description="Plans appear here once an operator has published one with a rate, a term and a stated yield source."
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

      <InvestDialog
        plan={choosing}
        onClose={() => setChoosing(null)}
        onDone={() => {
          toast({
            tone: 'success',
            title: 'Contract open',
            description: 'It now appears under All Investment, with its exact payout and date.',
          })
        }}
      />
    </>
  )
}
