import { cn, formatMoney } from '@/lib/utils'

/**
 * A headline total with its breakdown — the three cards across the top of the
 * dashboard.
 *
 * The left edge carries a colour bar rather than the whole card being tinted:
 * three saturated panels side by side compete with each other and with the
 * figures they hold, and the bar is enough to tell them apart at a glance.
 */

export interface BreakdownItem {
  label: string
  amount: number
}

const accentBar = {
  blue: 'before:bg-accent',
  green: 'before:bg-positive',
  amber: 'before:bg-warn',
} as const

export function SummaryCard({
  title,
  total,
  currency = 'USD',
  breakdown,
  note,
  tone = 'blue',
}: {
  title: string
  total: number
  currency?: string
  breakdown: BreakdownItem[]
  /** The sentence under the rule. Explains what the figures mean in context. */
  note?: React.ReactNode
  tone?: keyof typeof accentBar
}) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-xl border border-line bg-surface p-5 shadow-card',
        // The bar is a pseudo-element so it hugs the card's rounded corners.
        'before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-[""]',
        accentBar[tone],
      )}
    >
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>

      <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
        <span className="num text-[28px] font-bold leading-none tracking-tight text-ink">
          {formatMoney(total)}
        </span>
        <span className="text-sm font-medium text-muted">{currency}</span>
      </p>

      <dl className="mt-5 grid grid-cols-3 gap-3">
        {breakdown.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="truncate text-[13px] text-muted">{item.label}</dt>
            <dd className="num mt-1 text-sm font-medium text-ink">
              ${formatMoney(item.amount)}
            </dd>
          </div>
        ))}
      </dl>

      {note && (
        <p className="mt-4 border-t border-line pt-3.5 text-[13px] italic leading-relaxed text-muted">
          {note}
        </p>
      )}
    </section>
  )
}
