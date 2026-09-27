'use client'

import { useId } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { axisProps, chartColors } from '@/lib/chart-theme'
import type { PricePoint } from '@/lib/types'
import { formatCompact, formatCurrency, formatDate } from '@/lib/utils'
import { ChartTooltip } from './chart-tooltip'

interface PerformanceAreaChartProps {
  data: PricePoint[]
  height?: number
  /** Lime for portfolio value; red when the series is down over the window. */
  color?: string
  showAxes?: boolean
  valueFormatter?: (value: number) => string
  /** Accessible summary — the chart itself is decorative to screen readers. */
  ariaLabel: string
}

/**
 * Single-series area chart with a crosshair tooltip.
 *
 * One series, so no legend: the surrounding card title names what is plotted.
 */
export function PerformanceAreaChart({
  data,
  height = 280,
  color = chartColors.accent,
  showAxes = true,
  valueFormatter = (v) => formatCurrency(v),
  ariaLabel,
}: PerformanceAreaChartProps) {
  const gradientId = useId().replace(/:/g, '')

  return (
    <div role="img" aria-label={ariaLabel} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: showAxes ? 0 : -12, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Recessive grid: horizontal only, so it reads as a guide not a cage */}
          <CartesianGrid stroke={chartColors.grid} vertical={false} />

          <XAxis
            dataKey="time"
            {...axisProps}
            hide={!showAxes}
            minTickGap={40}
            tickFormatter={(value: string) => formatDate(value)}
          />
          <YAxis
            {...axisProps}
            hide={!showAxes}
            width={56}
            tickFormatter={(value: number) => formatCompact(value)}
            domain={['dataMin - dataMin * 0.04', 'dataMax + dataMax * 0.02']}
          />

          <Tooltip
            content={<ChartTooltip valueFormatter={valueFormatter} />}
            cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '4 4', strokeOpacity: 0.5 }}
          />

          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            // >=8px hit target on hover, hidden until then
            activeDot={{ r: 4.5, fill: color, stroke: chartColors.surface, strokeWidth: 2 }}
            dot={false}
            isAnimationActive
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
