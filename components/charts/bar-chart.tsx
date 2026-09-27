'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axisProps, chartColors } from '@/lib/chart-theme'
import type { PricePoint } from '@/lib/types'
import { formatCompact, formatDate } from '@/lib/utils'
import { ChartTooltip } from './chart-tooltip'

/**
 * Single-series column chart (platform volume, market comparison).
 * 4px rounded data-ends, anchored flat to the baseline.
 */
export function VolumeBarChart({
  data,
  height = 240,
  color = chartColors.accent,
  valueFormatter = (v: number) => formatCompact(v),
  ariaLabel,
  labelFormatter,
}: {
  data: PricePoint[]
  height?: number
  color?: string
  valueFormatter?: (value: number) => string
  ariaLabel: string
  labelFormatter?: (label: string) => string
}) {
  return (
    <div role="img" aria-label={ariaLabel} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid stroke={chartColors.grid} vertical={false} />
          <XAxis
            dataKey="time"
            {...axisProps}
            minTickGap={32}
            tickFormatter={(value: string) =>
              labelFormatter ? labelFormatter(value) : formatDate(value)
            }
          />
          <YAxis {...axisProps} width={52} tickFormatter={(value: number) => formatCompact(value)} />
          <Tooltip
            content={<ChartTooltip valueFormatter={valueFormatter} labelFormatter={labelFormatter} />}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          />
          <Bar
            dataKey="value"
            fill={color}
            radius={[4, 4, 0, 0]}
            isAnimationActive
            animationDuration={700}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
