/**
 * Shared chart tokens.
 *
 * Two distinct colour jobs, kept separate on purpose:
 *
 * 1. SINGLE-SERIES marks (portfolio performance, volume, sparklines) use the
 *    brand lime. One series needs no categorical palette — the title names it.
 *
 * 2. CATEGORICAL slots (asset allocation) use `categorical` below, a fixed
 *    order validated for the dark surface #0D100C: every hue sits in the
 *    OKLCH L 0.48–0.67 band, clears the chroma floor, holds ΔE ≥ 8 between
 *    adjacent pairs under deuteranopia and tritanopia, and passes 3:1 contrast
 *    against the surface. Do not add, reorder or substitute hues here without
 *    re-running the validator — and never cycle the list for extra series;
 *    anything beyond the eighth slot folds into `other`.
 *
 * Colour follows the entity, not its rank: `assetColor()` maps a given asset to
 * the same slot regardless of its position in a sorted list, so filtering a
 * chart never repaints the remaining segments.
 */

export const chartColors = {
  /** Brand lime — single-series marks and positive emphasis only. */
  accent: '#B8FF00',
  accentSoft: 'rgba(184,255,0,0.18)',
  positive: '#4ADE80',
  negative: '#F87171',
  grid: 'rgba(255,255,255,0.06)',
  axis: '#8C9188',
  surface: '#0D100C',
  surfaceRaised: '#11140F',
  /** Painted between adjacent fills to create the 2px separation gap. */
  gap: '#0D100C',
} as const

/** Validated fixed-order categorical slots. */
export const categorical = [
  '#749B14', // olive-lime
  '#2E7FD4', // blue
  '#E05A3C', // coral
  '#9B5CF0', // violet
  '#12A594', // teal
] as const

/** Neutral for aggregated remainder — never one of the categorical slots. */
export const otherColor = '#5A615A'

/** Stable asset → categorical slot assignment. */
const assetSlot: Record<string, number> = {
  btc: 0,
  eth: 1,
  sol: 2,
  usdt: 3,
  bnb: 4,
}

export function assetColor(assetId: string): string {
  const slot = assetSlot[assetId.toLowerCase()]
  return slot === undefined ? otherColor : categorical[slot]
}

/** Axis/tick props shared by every cartesian chart. */
export const axisProps = {
  stroke: 'transparent',
  tick: { fill: chartColors.axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const
