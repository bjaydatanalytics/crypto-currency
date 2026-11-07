'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'

/**
 * Shared chart tokens, per theme.
 *
 * Two distinct colour jobs, kept separate on purpose:
 *
 * 1. SINGLE-SERIES marks (portfolio performance, volume, sparklines) use the
 *    brand accent. One series needs no categorical palette — the title names it.
 *
 * 2. CATEGORICAL slots (asset allocation) use the `categorical` list, a fixed
 *    order where every hue sits in the OKLCH lightness band, clears the chroma
 *    floor, holds ΔE ≥ 8 between adjacent pairs under deuteranopia and
 *    tritanopia, and reaches 3:1 contrast against its own surface. Each theme
 *    has its own list, validated against its own surface — a dark palette is
 *    never flipped automatically onto a light one. Do not add, reorder or
 *    substitute hues without re-running the validator, and never cycle the
 *    list for extra series; anything past the last slot folds into `other`.
 *
 * Colour follows the entity, not its rank: `assetColor()` maps a given asset to
 * the same slot regardless of its position in a sorted list, so filtering a
 * chart never repaints the remaining segments.
 */

export interface ChartTheme {
  accent: string
  accentSoft: string
  positive: string
  negative: string
  grid: string
  axis: string
  surface: string
  surfaceRaised: string
  /** Painted between adjacent fills to create the 2px separation gap. */
  gap: string
  categorical: readonly string[]
  /** Neutral for aggregated remainder — never one of the categorical slots. */
  other: string
}

/** Dark lime — marketing site, auth screens, admin console. */
export const darkChartTheme: ChartTheme = {
  accent: '#B8FF00',
  accentSoft: 'rgba(184,255,0,0.18)',
  positive: '#4ADE80',
  negative: '#F87171',
  grid: 'rgba(255,255,255,0.06)',
  axis: '#8C9188',
  surface: '#0D100C',
  surfaceRaised: '#11140F',
  gap: '#0D100C',
  // Validated against surface #0D100C.
  categorical: ['#749B14', '#2E7FD4', '#E05A3C', '#9B5CF0', '#12A594'],
  other: '#5A615A',
}

/** Light blue — the signed-in customer panel. */
export const lightChartTheme: ChartTheme = {
  accent: '#2563EB',
  accentSoft: 'rgba(37,99,235,0.16)',
  positive: '#16A34A',
  negative: '#DC2626',
  grid: 'rgba(15,23,42,0.08)',
  axis: '#64748B',
  surface: '#FFFFFF',
  surfaceRaised: '#F8FAFC',
  gap: '#FFFFFF',
  /**
   * Same hue identities as the dark list so an asset keeps its colour across
   * themes, re-validated against a white surface. The teal is one step darker
   * than its dark-theme counterpart (#12A594), which lands at 2.99:1 on white
   * and fails the contrast check.
   */
  categorical: ['#749B14', '#2E7FD4', '#E05A3C', '#9B5CF0', '#0F8C7E'],
  other: '#94A3B8',
}

/* ------------------------------------------------------------------ */
/* Theme detection                                                     */
/* ------------------------------------------------------------------ */

/**
 * Resolves which theme a chart is rendering into.
 *
 * Charts are shared between the dark site and the light panel, so the theme is
 * a property of *where the chart is mounted*, not of the component. Walking up
 * to the nearest `[data-panel]` answers that exactly, with no prop to thread
 * through every intermediate component and no chance of a page forgetting it.
 *
 * Starts dark to match the server-rendered markup; the effect corrects it
 * before paint on the panel. Returns the ref to attach to the chart's wrapper.
 */
export function useChartTheme<T extends Element = HTMLDivElement>(): [
  RefObject<T | null>,
  ChartTheme,
] {
  const ref = useRef<T | null>(null)
  const [theme, setTheme] = useState<ChartTheme>(darkChartTheme)

  useEffect(() => {
    const inPanel = ref.current?.closest('[data-panel]') != null
    setTheme(inPanel ? lightChartTheme : darkChartTheme)
  }, [])

  return [ref, theme]
}

/* ------------------------------------------------------------------ */
/* Asset colours                                                       */
/* ------------------------------------------------------------------ */

/** Stable asset → categorical slot assignment. */
const assetSlot: Record<string, number> = {
  btc: 0,
  eth: 1,
  sol: 2,
  usdt: 3,
  bnb: 4,
}

export function assetColor(assetId: string, theme: ChartTheme = darkChartTheme): string {
  const slot = assetSlot[assetId.toLowerCase()]
  return slot === undefined ? theme.other : theme.categorical[slot]
}

/** Axis/tick props shared by every cartesian chart. */
export function axisPropsFor(theme: ChartTheme) {
  return {
    stroke: 'transparent',
    tick: { fill: theme.axis, fontSize: 11 },
    tickLine: false,
    axisLine: false,
  } as const
}
