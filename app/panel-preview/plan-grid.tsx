'use client'

import { useState } from 'react'
import { InvestDialog } from '@/components/dashboard/invest-dialog'
import { PlanCard, planCardTerms, type PlanCardTerms } from '@/components/dashboard/plan-card'
import type { InvestmentPlan } from '@/lib/types'

interface Investable {
  plan: InvestmentPlan
  terms: PlanCardTerms
}

/**
 * The plan grid, rendered from whatever rows the preview was given.
 *
 * Invest Now opens the real `InvestDialog`, so the confirm step can be
 * reviewed without signing in. It is safe to open here: the dialog only
 * *reads* balances and quotes to render itself, and its Yes button posts to
 * `/api/investments`, which requires a verified session and would refuse this
 * anonymous preview. Nothing can be subscribed to from this page.
 */
export function PreviewPlanGrid({
  plans,
}: {
  plans: (InvestmentPlan & { published: boolean })[]
}) {
  const [choosing, setChoosing] = useState<InvestmentPlan | null>(null)

  const investable = plans
    .map((plan) => ({ plan, terms: planCardTerms(plan) }))
    .filter((entry): entry is Investable & { plan: (typeof plans)[number] } => entry.terms !== null)

  if (investable.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line px-6 py-10 text-center text-sm text-muted">
        No plan in the database has both a rate and a term, so there is nothing to show here.
      </p>
    )
  }

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {investable.map(({ plan, terms }) => (
          <li key={plan.id} className="relative flex">
            {!plan.published && (
              <span className="absolute right-3 top-3 z-10 rounded-full border border-warn/30 bg-warn/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-warn">
                Draft
              </span>
            )}
            <PlanCard plan={plan} terms={terms} onInvest={() => setChoosing(plan)} />
          </li>
        ))}
      </ul>

      <InvestDialog
        plan={choosing}
        onClose={() => setChoosing(null)}
        onDone={() => setChoosing(null)}
      />
    </>
  )
}
