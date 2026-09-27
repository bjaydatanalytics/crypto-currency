import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Currency with sensible precision for both $67,000 and $0.000018 tokens. */
export function formatCurrency(
  value: number,
  opts: { compact?: boolean; currency?: string } = {},
) {
  const { compact = false, currency = 'USD' } = opts

  if (compact) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(value)
  }

  const abs = Math.abs(value)
  const fractionDigits = abs >= 1000 ? 2 : abs >= 1 ? 2 : abs > 0 ? 6 : 2

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits > 2 ? 2 : fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

export function formatNumber(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value)
}

export function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value)
}

/** Token amounts: keep enough precision without trailing noise. */
export function formatAmount(value: number, decimals = 6) {
  if (value === 0) return '0'
  const d = Math.abs(value) >= 1 ? Math.min(decimals, 4) : decimals
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: d }).format(value)
}

export function formatPercent(value: number, withSign = true) {
  const sign = withSign && value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function formatDate(iso: string, style: 'short' | 'long' | 'datetime' = 'short') {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'

  if (style === 'long') {
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }
  if (style === 'datetime') {
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function relativeTime(iso: string) {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'

  const diff = Date.now() - then
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`

  return formatDate(iso)
}

/** Tailwind text colour for a signed change value. */
export function changeColor(value: number) {
  if (value > 0) return 'text-positive'
  if (value < 0) return 'text-negative'
  return 'text-muted'
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

/**
 * Deterministic pseudo-random generator.
 *
 * Mock series are generated from a seed so the server render and the client
 * hydration produce identical numbers — random values here would cause
 * hydration mismatches and flickering charts.
 */
export function seededRandom(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

/** Builds a plausible-looking price walk for demo charts. */
export function generateSeries(
  seed: number,
  points: number,
  start: number,
  volatility = 0.02,
): number[] {
  const rand = seededRandom(seed)
  const out: number[] = []
  let value = start
  for (let i = 0; i < points; i++) {
    const drift = (rand() - 0.5) * 2 * volatility
    value = Math.max(value * (1 + drift), start * 0.55)
    out.push(Number(value.toFixed(value < 10 ? 4 : 2)))
  }
  return out
}

/** Small delay used by the mock service layer to mimic network latency. */
export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function initials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}
