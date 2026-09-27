'use client'

import { useId } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { axisProps, chartColors } from '@/lib/chart-theme'
import type { Candle, Timeframe } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { ChartTooltip } from './chart-tooltip'

/** Time-axis formatting appropriate to the selected window. */
function tickFormatterFor(timeframe: Timeframe) {
  return (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    if (timeframe === '1H' || timeframe === '4H' || timeframe === '1D') {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}

/**
 * Close-price chart for the trading view.
 *
 * Plots the closing series rather than full candles: at these widths candle
 * bodies compress to noise, and the close line is what the price readout and
 * the order panel actually reference.
 */
export function PriceChart({
  candles,
  timeframe,
  height = 340,
  ariaLabel,
}: {
  candles: Candle[]
  timeframe: Timeframe
  height?: number
  ariaLabel: string
}) {
  const gradientId = useId().replace(/:/g, '')

  const data = candles.map((candle) => ({ time: candle.time, value: candle.close }))
  const first = data[0]?.value ?? 0
  const last = data[data.length - 1]?.value ?? 0
  const up = last >= first
  const color = up ? chartColors.accent : chartColors.negative
  const formatTick = tickFormatterFor(timeframe)

  return (
    <div role="img" aria-label={ariaLabel} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke={chartColors.grid} vertical={false} />

          <XAxis dataKey="time" {...axisProps} minTickGap={48} tickFormatter={formatTick} />
          <YAxis
            {...axisProps}
            width={72}
            orientation="right"
            domain={['dataMin - dataMin * 0.004', 'dataMax + dataMax * 0.004']}
            tickFormatter={(value: number) => formatCurrency(value, { compact: value >= 10000 })}
          />

          {/* Opening level of the window, so the move is readable at a glance */}
          <ReferenceLine
            y={first}
            stroke={chartColors.axis}
            strokeDasharray="3 5"
            strokeOpacity={0.45}
          />

          <Tooltip
            content={
              <ChartTooltip
                valueFormatter={(v) => formatCurrency(v)}
                labelFormatter={(label) => formatTick(label)}
              />
            }
            cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '4 4', strokeOpacity: 0.55 }}
          />

          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4.5, fill: color, stroke: chartColors.surface, strokeWidth: 2 }}
            isAnimationActive
            animationDuration={600}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
