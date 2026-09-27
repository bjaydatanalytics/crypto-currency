'use client'

import { useId, useMemo } from 'react'
import { chartColors } from '@/lib/chart-theme'

/**
 * Sparkline drawn as inline SVG rather than a charting library.
 *
 * Market cards render dozens of these; a full Recharts instance each would cost
 * far more than the shape is worth. No axes, no tooltip — it is a trend glyph
 * beside a number that already states the value, so it carries aria-hidden and
 * the card's own text provides the accessible reading.
 */
export function Sparkline({
  data,
  width = 120,
  height = 40,
  positive = true,
  className,
}: {
  data: number[]
  width?: number
  height?: number
  positive?: boolean
  className?: string
}) {
  const gradientId = useId().replace(/:/g, '')
  const color = positive ? chartColors.positive : chartColors.negative

  const { linePath, areaPath } = useMemo(() => {
    if (data.length < 2) return { linePath: '', areaPath: '' }

    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    // Inset vertically so the 2px stroke is never clipped at the extremes
    const pad = 3

    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width
      const y = height - pad - ((value - min) / range) * (height - pad * 2)
      return [x, y] as const
    })

    const line = points
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
      .join(' ')

    return {
      linePath: line,
      areaPath: `${line} L${width},${height} L0,${height} Z`,
    }
  }, [data, width, height])

  if (!linePath) return null

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
