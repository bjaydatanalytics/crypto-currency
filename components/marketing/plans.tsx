import { ButtonLink } from '@/components/ui/button'
import { RevealGroup, RevealItem } from '@/components/ui/reveal'
import { Section, SectionHeading } from '@/components/ui/section'
import { assurances, platform } from '@/lib/config'
import { listPublicPlans } from '@/lib/server/plans'
import type { InvestmentPlan } from '@/lib/types'
import { cn, formatMoney } from '@/lib/utils'

/**
 * Public investment packages.
 *
 * Every figure is derived from the stored plan, never typed into the markup:
 * the headline rate, the term, the stake range and the earnings range all come
 * from `investment_plans`, so a change in /admin/plans is reflected here on the
 * next request and the page cannot drift from the terms actually on offer.
 */

/* ------------------------------------------------------------------ */
/* Derived wording                                                     */
/* ------------------------------------------------------------------ */

/**
 * The term, phrased the way a customer reads it.
 *
 * Short terms are stated in hours because "after 1 day" is vague about when a
 * payout lands and "after 24 hours" is not. Beyond four days the hour count
 * stops being meaningful and days read better.
 */
function describeTerm(days: number | null): string | null {
  if (days === null) return null
  if (days <= 4) return `After ${days * 24} hours`
  return `After ${days} days`
}

/**
 * What the plan pays, across its whole stake range.
 *
 * A single "max earn" figure answers only what the largest permitted stake
 * returns, which is not what most people are about to invest. Showing both
 * ends makes the card answer "what would I get" rather than "what could
 * somebody get".
 */
function earningsRange(plan: InvestmentPlan): string | null {
  const rate = plan.fixedRatePercent
  if (rate === null || rate === undefined) return null

  const low = plan.minimumAmount === null ? null : (plan.minimumAmount * rate) / 100
  const high = plan.maximumAmount === null ? null : (plan.maximumAmount * rate) / 100

  if (low === null && high === null) return null
  if (high === null) return `$${formatMoney(low!)}+`
  if (low === null) return `Up to $${formatMoney(high)}`
  return `$${formatMoney(low)} – $${formatMoney(high)}`
}

function stakeRange(plan: InvestmentPlan): { minimum: string; maximum: string } {
  return {
    minimum: plan.minimumAmount === null ? 'No minimum' : `$${formatMoney(plan.minimumAmount)}`,
    // "No limit" is a real term, distinct from a limit nobody has configured.
    maximum: plan.maximumAmount === null ? 'No limit' : `$${formatMoney(plan.maximumAmount)}`,
  }
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="num text-sm font-medium text-ink">{value}</dd>
    </div>
  )
}

export function PlanCard({ plan }: { plan: InvestmentPlan }) {
  const term = describeTerm(plan.duration)
  const earnings = earningsRange(plan)
  const { minimum, maximum } = stakeRange(plan)
  const promisesReturn = plan.fixedRatePercent !== null && plan.fixedRatePercent !== undefined

  return (
    <div
      className={cn(
        'relative flex h-full flex-col overflow-hidden rounded-2xl border bg-surface text-center transition-all duration-300',
        plan.popular
          ? 'border-accent/40 shadow-glow-sm'
          : 'border-line hover:border-accent/30 hover:-translate-y-0.5',
      )}
    >
      {plan.popular && (
        <span className="absolute right-4 top-4 rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-on-accent">
          Most chosen
        </span>
      )}

      <div className="p-7">
        <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-ink">
          {plan.name} Investment
        </h3>

        {promisesReturn ? (
          <>
            <p className="num mt-5 text-[52px] font-bold leading-none tracking-tight text-accent">
              {plan.fixedRatePercent}%
            </p>
            <p className="mt-2 text-sm text-muted">
              {term ?? 'Term set by operator'}
              {plan.rateBasis === 'annual' && ' · quoted per year'}
            </p>
          </>
        ) : (
          <p className="mt-5 text-sm italic leading-relaxed text-muted">
            This plan promises no fixed return.
          </p>
        )}
      </div>

      {earnings && (
        <div className="border-y border-line bg-elevate/[0.02] px-7 py-4">
          <p className="num text-xl font-bold tracking-tight text-ink">{earnings}</p>
          <p className="mt-0.5 text-xs text-muted">Total earnings across the stake range</p>
        </div>
      )}

      <div className="flex flex-1 flex-col p-7 pt-5 text-left">
        <dl className="divide-y divide-line">
          <Detail label="Minimum" value={minimum} />
          <Detail label="Maximum" value={maximum} />
          <Detail
            label="Payment server"
            value={
              /*
               * Reports the real custody flag rather than a decorative
               * "Active". A payments indicator that is hardcoded to green
               * tells a customer deposits work on the one day they do not.
               */
              platform.custodyEnabled ? (
                <span className="text-positive">Active</span>
              ) : (
                <span className="text-warn">Not yet live</span>
              )
            }
          />
        </dl>

        <ButtonLink
          href="/register"
          variant={plan.popular ? 'primary' : 'secondary'}
          fullWidth
          className="mt-6"
        >
          Choose Plan
        </ButtonLink>

        {assurances.depositAssurance && (
          <p className="mt-5 border-t border-line pt-4 text-center text-[10px] font-semibold uppercase tracking-wide text-muted">
            {assurances.depositAssurance}
          </p>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

/**
 * Plan cards, read from the database at request time.
 *
 * A server component rather than a client fetch, and deliberately uncached:
 * these are published commercial terms, so the page must show what the
 * operator set a moment ago, not what was true when the site was last built.
 *
 * Only published plans are returned, and only the standard catalogue —
 * retirement plans have their own page and would otherwise appear twice.
 *
 * A database failure does **not** take the page down. This section renders on
 * the public homepage, and an uncaught throw here turned a brief Neon blip into
 * a 500 on `/`. The two failure modes are reported differently on purpose:
 *
 *   plans.length === 0   →  "nothing published yet"   (true, and knowable)
 *   unavailable === true  →  "terms unavailable"       (we do not know)
 *
 * Collapsing them would tell a visitor no plans are offered when several are.
 */
export async function Plans({ heading = true }: { heading?: boolean }) {
  let plans: InvestmentPlan[] = []
  let unavailable = false

  try {
    plans = await listPublicPlans('standard')
  } catch (error) {
    console.error('[plans] could not load published plans:', error)
    unavailable = true
  }


  return (
    <Section id="investment-plans">
      <div className="container-x">
        {heading && (
          <SectionHeading
            eyebrow="Choose Package"
            title="A pricing offer for fast investment solution"
            description="Each package sets its own rate, term and stake range. Every figure below is the term actually on offer — not an illustration."
            align="center"
            className="mx-auto max-w-2xl"
          />
        )}

        {unavailable ? (
          <p className="mx-auto mt-12 max-w-lg rounded-xl border border-warn/30 bg-warn/[0.05] px-6 py-10 text-center text-sm leading-relaxed text-ink/80">
            Plan terms cannot be loaded right now. This is a temporary problem on our side, not a
            change to what is offered — please try again shortly.
          </p>
        ) : plans.length === 0 ? (
          <p className="mx-auto mt-12 max-w-lg rounded-xl border border-dashed border-line px-6 py-10 text-center text-sm leading-relaxed text-muted">
            No packages are published yet. Terms are configured by the operator and will appear
            here once they are.
          </p>
        ) : (
          <RevealGroup as="ul" className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <RevealItem as="li" key={plan.id} className="flex">
                <PlanCard plan={plan} />
              </RevealItem>
            ))}
          </RevealGroup>
        )}

      </div>
    </Section>
  )
}
