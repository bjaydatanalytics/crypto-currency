'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { assetColor, chartColors } from '@/lib/chart-theme'
import type { Holding } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

/**
 * Asset allocation donut.
 *
 * Categorical encoding, so identity is never colour-alone: every slice is also
 * named in the legend list beside the chart with its share and value. Segments
 * are separated by a 2px surface-coloured stroke plus a small pad angle.
 */
export function AllocationDonut({
  holdings,
  height = 260,
}: {
  holdings: Holding[]
  height?: number
}) {
  const data = holdings.map((h) => ({
    name: h.name,
    symbol: h.symbol,
    value: h.value,
    allocation: h.allocation,
    fill: assetColor(h.assetId),
  }))

  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div
        className="relative w-full max-w-[200px] shrink-0"
        style={{ height }}
        role="img"
        aria-label={`Asset allocation across ${holdings.length} assets. ${holdings
          .map((h) => `${h.name} ${h.allocation}%`)
          .join(', ')}.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="symbol"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={2}
              stroke={chartColors.surface}
              strokeWidth={2}
              isAnimationActive
              animationDuration={700}
            >
              {data.map((entry) => (
                <Cell key={entry.symbol} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const item = payload[0].payload as (typeof data)[number]
                return (
                  <div className="rounded-xl border border-line bg-surface-raised px-3.5 py-2.5 shadow-2xl">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-sm"
                        style={{ backgroundColor: item.fill }}
                        aria-hidden="true"
                      />
                      <span className="text-sm font-medium text-white">{item.name}</span>
                    </div>
                    <p className="num mt-1 text-sm text-white/80">
                      {formatCurrency(item.value)} · {item.allocation}%
                    </p>
                  </div>
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Hero value in the hole — the one number the chart is really about */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] uppercase tracking-wider text-muted">Total</span>
          <span className="num mt-1 text-lg font-semibold text-white">
            {formatCurrency(total, { compact: true })}
          </span>
        </div>
      </div>

      {/*
        Legend doubles as this chart's data table, so identity is never carried
        by colour alone. Name and share share a row; the value sits beneath, so
        nothing collapses when the card is narrow.
      */}
      <ul className="w-full min-w-0 flex-1 space-y-2.5">
        {data.map((item) => (
          <li key={item.symbol} className="flex items-start gap-2.5">
            <span
              className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: item.fill }}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-white/90">{item.name}</p>
              <p className="num mt-0.5 text-xs text-muted">
                <span className="text-white/70">{item.allocation}%</span>
                <span className="mx-1.5">·</span>
                {formatCurrency(item.value, { compact: true })}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
