import Link from 'next/link'
import { formatMoney } from '@/lib/utils'

/**
 * The 401k promotion.
 *
 * Deliberately the one dark surface in a light panel — it is a promotion, not
 * a report, and the contrast is what separates the two. Its text is literally
 * white rather than `text-ink` because the fill is always navy, in both themes.
 *
 * `plansOpen` decides what the copy claims. A row of zeroes beside "explore
 * our plans" reads as an empty-but-real position, which is a different thing
 * from there being nothing to subscribe to — so the banner says which it is,
 * driven by whether a retirement plan is actually published rather than by a
 * sentence that goes stale the moment one is.
 */

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/[0.07] px-4 py-3.5">
      <p className="text-[13px] text-white/60">{label}</p>
      <p className="num mt-1.5 text-xl font-bold tracking-tight text-white">
        ${formatMoney(value)}
      </p>
    </div>
  )
}

export function RetirementBanner({
  total = 0,
  running = 0,
  earned = 0,
  plansOpen = false,
}: {
  total?: number
  running?: number
  earned?: number
  /** True when at least one retirement plan is published and subscribable. */
  plansOpen?: boolean
}) {
  return (
    <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-navy-deep via-navy to-navy-soft p-6 sm:p-7">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
            Retirement portfolio
          </span>

          <h2 className="mt-3.5 text-[28px] font-bold leading-tight tracking-tight text-white">
            401k Investment
          </h2>

          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/70">
            A dedicated retirement position with returns paid on the same automated schedule as
            your other plans.{' '}
            {!plansOpen && (
              <span className="font-medium text-white/90">
                No retirement plan is open for subscription yet.
              </span>
            )}
          </p>

          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link
              href="/dashboard/401k"
              className="inline-flex min-h-[44px] items-center rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-bright"
            >
              Explore 401k Plans
            </Link>
            <Link
              href="/dashboard/investments"
              className="inline-flex min-h-[44px] items-center rounded-xl bg-white/10 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
            >
              View Activity
            </Link>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:w-[420px]">
          <Figure label="Total 401k" value={total} />
          <Figure label="Running" value={running} />
          <Figure label="Earned" value={earned} />
        </div>
      </div>
    </section>
  )
}
