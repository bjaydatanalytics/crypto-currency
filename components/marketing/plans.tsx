import { Check, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { RiskNotice } from '@/components/ui/demo-notice'
import { RevealGroup, RevealItem } from '@/components/ui/reveal'
import { Section, SectionHeading } from '@/components/ui/section'
import { listPublicPlans } from '@/lib/server/plans'
import type { InvestmentPlan } from '@/lib/types'
import { cn, formatCurrency } from '@/lib/utils'

/**
 * Renders a configured value, or a clear "not set" marker.
 *
 * Commercial terms are owned by the backend. Where a value is null this shows
 * that it is still to be configured rather than filling the gap with a
 * placeholder figure a visitor could mistake for a real minimum or fee.
 */
function Term({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd
        className={cn(
          'text-sm',
          value ? 'num font-medium text-white' : 'text-xs italic text-muted',
        )}
      >
        {value ?? 'Set by operator'}
      </dd>
    </div>
  )
}

export function PlanCard({ plan }: { plan: InvestmentPlan }) {
  return (
    <Card
      interactive
      className={cn(
        'relative flex h-full flex-col p-6',
        plan.popular && 'border-accent/35 bg-surface-raised',
      )}
    >
      {plan.popular && (
        <span className="absolute -top-3 left-6">
          <Badge tone="accent">Most chosen</Badge>
        </span>
      )}

      <h3 className="text-lg font-semibold uppercase tracking-wide text-white">{plan.name}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{plan.summary}</p>

      {/**
       * The promised return, shown with its basis.
       *
       * A rate is never rendered as a bare percentage: "8%" means two different
       * things per-term and annual, and the ambiguity reads in the seller's
       * favour. The line underneath states that payment depends on the
       * platform's solvency, because a contractual return is only as good as
       * the business behind it and a visitor comparing plans deserves to know
       * that on the card, not buried in a disclosure.
       */}
      {plan.fixedRatePercent !== null && plan.fixedRatePercent !== undefined && (
        <div className="mt-5 rounded-xl border border-accent/25 bg-accent/[0.06] p-4">
          <p className="num text-2xl font-semibold tracking-tight text-accent">
            {plan.fixedRatePercent}%
          </p>
          <p className="mt-0.5 text-xs text-white/80">
            {plan.rateBasis === 'annual'
              ? 'a year, pro-rated across the term'
              : 'over the full term'}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Contractual, not a projection. Payment depends on this platform remaining solvent —
            it is not a bank deposit and no deposit guarantee scheme applies.
          </p>
        </div>
      )}

      <dl className="mt-6 divide-y divide-line border-y border-line">
        <Term
          label="Minimum amount"
          value={plan.minimumAmount === null ? null : formatCurrency(plan.minimumAmount)}
        />
        <Term
          label="Maximum amount"
          value={plan.maximumAmount === null ? null : formatCurrency(plan.maximumAmount)}
        />
        <Term label="Platform fee" value={plan.fee === null ? null : `${plan.fee}%`} />
        <Term
          label="Duration"
          value={plan.duration === null ? null : `${plan.duration} days`}
        />
      </dl>

      <ul className="mt-6 flex-1 space-y-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm text-white/80">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            <span className="leading-relaxed">{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-lg border border-line bg-white/[0.02] p-3.5">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" aria-hidden="true" />
          <span>{plan.riskDisclosure}</span>
        </p>
      </div>

      <ButtonLink
        href="/register"
        variant={plan.popular ? 'primary' : 'secondary'}
        fullWidth
        className="mt-6"
      >
        Get Started
      </ButtonLink>
    </Card>
  )
}

/**
 * Plan cards, read from the database at request time.
 *
 * A server component rather than a client fetch, and deliberately uncached:
 * these are published commercial terms, so the page must show what the
 * operator set a moment ago, not what was true when the site was last built.
 *
 * Only published plans are returned. If none are, the section says so instead
 * of rendering an empty grid — a page that looks broken is better than one
 * that quietly implies there are no plans when there are three unpublished
 * drafts.
 *
 * A database failure does **not** take the page down. This section renders on
 * the public homepage, and an uncaught throw here turned a brief Neon blip into
 * a 500 on `/` — a marketing page that cannot be reached because a query timed
 * out. The read is wrapped, and the two failure modes are reported differently
 * on purpose:
 *
 *   plans.length === 0   →  "nothing published yet"   (true, and knowable)
 *   unavailable === true  →  "terms unavailable"       (we do not know)
 *
 * Collapsing them would tell a visitor no plans are offered when three are,
 * which is a false statement about the product rather than a degraded page.
 */
export async function Plans({ heading = true }: { heading?: boolean }) {
  let plans: InvestmentPlan[] = []
  let unavailable = false

  try {
    plans = await listPublicPlans()
  } catch (error) {
    // Logged so it reaches Vercel's runtime logs and any error reporter; the
    // visitor gets a degraded section rather than a 500.
    console.error('[plans] could not load published plans:', error)
    unavailable = true
  }

  return (
    <Section id="investment-plans">
      <div className="container-x">
        {heading && (
          <SectionHeading
            eyebrow="Investment Plans"
            title="Choose the tier that fits how you invest"
            description="Plans differ by the tools and support they include. Amounts, fees and durations are set by the operator and shown here once configured."
            align="center"
            className="mx-auto max-w-2xl"
          />
        )}

        {unavailable ? (
          <p className="mx-auto mt-12 max-w-lg rounded-xl border border-warn/30 bg-warn/[0.05] px-6 py-10 text-center text-sm leading-relaxed text-white/80">
            Plan terms cannot be loaded right now. This is a temporary problem on our side, not a
            change to what is offered — please try again shortly.
          </p>
        ) : plans.length === 0 ? (
          <p className="mx-auto mt-12 max-w-lg rounded-xl border border-dashed border-line px-6 py-10 text-center text-sm leading-relaxed text-muted">
            No plans are published yet. Terms are configured by the operator and will appear here
            once they are.
          </p>
        ) : (
          <RevealGroup as="ul" className="mt-12 grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <RevealItem as="li" key={plan.id}>
                <PlanCard plan={plan} />
              </RevealItem>
            ))}
          </RevealGroup>
        )}

        <RiskNotice className="mx-auto mt-10 max-w-3xl">
          <p>
            A plan is a service tier, not a promise of performance. No plan on this platform offers
            a guaranteed, fixed or risk-free return, and none is offered here. The value of digital
            assets can fall as well as rise, you may get back less than you put in, and past
            performance does not predict future results. Fees reduce returns. Consider independent
            advice before investing.
          </p>
        </RiskNotice>
      </div>
    </Section>
  )
}
