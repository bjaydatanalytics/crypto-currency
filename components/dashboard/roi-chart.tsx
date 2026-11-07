'use client'

import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axisPropsFor, useChartTheme } from '@/lib/chart-theme'
import { formatMoney } from '@/lib/utils'

export interface RoiPoint {
  /** ISO date, `YYYY-MM-DD`. */
  date: string
  /** Return credited that day, in USD. */
  value: number
}

/**
 * Daily return over the last 30 days.
 *
 * Bars rather than a line or an area: a return is credited on a specific day,
 * not accrued continuously between days. A line sloping from one payout to the
 * next would draw earnings on days when nothing was paid.
 *
 * One series, so no legend — the card title names what is plotted.
 */
export function RoiChart({ data, height = 260 }: { data: RoiPoint[]; height?: number }) {
  const [ref, theme] = useChartTheme()
  const axisProps = axisPropsFor(theme)

  const total = useMemo(() => data.reduce((sum, point) => sum + point.value, 0), [data])

  /**
   * An all-zero window is a real answer, not a missing one, but a chart of
   * thirty flat bars says it far less clearly than a sentence does.
   */
  if (total === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line px-6 py-12 text-center"
        style={{ minHeight: height }}
      >
        <p className="text-sm font-medium text-ink">No returns in the last 30 days</p>
        <p className="max-w-xs text-[13px] leading-relaxed text-muted">
          Returns appear here on the day each investment matures and the payout is credited to
          your balance.
        </p>
      </div>
    )
  }

  const formatDay = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })

  return (
    <div
      ref={ref}
      role="img"
      aria-label={`Daily return over the last ${data.length} days, totalling ${formatMoney(total)} US dollars.`}
      style={{ width: '100%', height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="24%">
          {/* Horizontal only, so the grid reads as a guide rather than a cage */}
          <CartesianGrid stroke={theme.grid} vertical={false} />

          <XAxis dataKey="date" {...axisProps} minTickGap={28} tickFormatter={formatDay} />
          <YAxis
            {...axisProps}
            width={56}
            tickFormatter={(value: number) => `$${formatMoney(value)}`}
          />

          <Tooltip
            cursor={{ fill: theme.grid }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <div className="rounded-xl border border-line bg-surface-raised px-3.5 py-2.5 shadow-lg">
                  <p className="text-[11px] uppercase tracking-wider text-muted">
                    {formatDay(String(label))}
                  </p>
                  <p className="num mt-1 text-sm font-medium text-ink">
                    ${formatMoney(Number(payload[0].value))}
                  </p>
                </div>
              )
            }}
          />

          {/* 4px rounded data-ends, anchored flat to the baseline */}
          <Bar
            dataKey="value"
            fill={theme.accent}
            radius={[4, 4, 0, 0]}
            isAnimationActive
            animationDuration={600}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
