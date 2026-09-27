'use client'

import type { TooltipProps } from 'recharts'
import { formatCurrency, formatDate } from '@/lib/utils'

/**
 * Shared tooltip surface.
 *
 * Values wear text tokens rather than the series colour; a small colour chip
 * beside the label carries identity instead.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter = (v: number) => formatCurrency(v),
  labelFormatter,
}: TooltipProps<number, string> & {
  valueFormatter?: (value: number) => string
  labelFormatter?: (label: string) => string
}) {
  if (!active || !payload?.length) return null

  const heading =
    labelFormatter && typeof label === 'string'
      ? labelFormatter(label)
      : typeof label === 'string' && label.includes('T')
        ? formatDate(label, 'datetime')
        : String(label ?? '')

  return (
    <div className="rounded-xl border border-line bg-surface-raised px-3.5 py-2.5 shadow-2xl">
      <p className="text-[11px] uppercase tracking-wider text-muted">{heading}</p>
      <div className="mt-1.5 space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ backgroundColor: entry.color }}
              aria-hidden="true"
            />
            <span className="num text-sm font-medium text-white">
              {valueFormatter(Number(entry.value))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
