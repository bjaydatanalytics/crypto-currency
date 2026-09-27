'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Activity, ArrowUpRight, PieChart, Wallet } from 'lucide-react'
import { PerformanceAreaChart } from '@/components/charts/area-chart'
import { Sparkline } from '@/components/charts/sparkline'
import { AssetIcon, ChangePill } from '@/components/ui/asset-icon'
import { demoPortfolio, getAsset, marketQuotes } from '@/lib/mock-data'
import { formatCurrency } from '@/lib/utils'

/**
 * Hero composition: a realistic portfolio panel with floating stat cards.
 *
 * Every figure here is sample data from `lib/mock-data.ts`. The panel carries
 * its own "Sample data" chip so the numbers can't be read as a real account,
 * and the surrounding hero copy repeats it.
 */

const featured = ['BTC', 'ETH', 'SOL', 'USDT']
  .map((symbol) => marketQuotes.find((q) => q.symbol === symbol)!)
  .filter(Boolean)

function FloatingCard({
  children,
  className,
  delay = 0,
  float = true,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  float?: boolean
}) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      <div
        className={
          float && !reduce
            ? 'animate-float rounded-2xl border border-line bg-surface-raised/90 p-4 shadow-2xl backdrop-blur-xl'
            : 'rounded-2xl border border-line bg-surface-raised/90 p-4 shadow-2xl backdrop-blur-xl'
        }
        style={float && !reduce ? { animationDelay: `${delay * 2}s` } : undefined}
      >
        {children}
      </div>
    </motion.div>
  )
}

export function HeroVisual() {
  const portfolio = demoPortfolio
  const performance = portfolio.performance.slice(-30)

  return (
    <div className="relative mx-auto w-full max-w-[560px] lg:max-w-none">
      {/* Lime bloom behind the composition */}
      <div
        className="pointer-events-none absolute -inset-16 -z-10 opacity-70 blur-3xl"
        style={{
          background:
            'radial-gradient(45% 45% at 60% 35%, rgba(184,255,0,0.16), transparent 70%), radial-gradient(40% 40% at 25% 70%, rgba(46,127,212,0.10), transparent 70%)',
        }}
        aria-hidden="true"
      />

      {/* Main panel */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-3xl border border-line bg-surface/95 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/12 text-accent">
              <Wallet className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium text-white">Portfolio overview</p>
              <p className="text-[11px] text-muted">Sample data · not a real account</p>
            </div>
          </div>
          {/* Badge is hidden from xl up: the trading-volume card overlaps this corner there */}
          <span className="hidden items-center gap-1.5 rounded-full border border-accent/20 bg-accent/[0.07] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-accent sm:inline-flex xl:hidden">
            <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-accent" />
            Live demo
          </span>
        </div>

        <div className="px-5 pt-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Total value</p>
          <div className="mt-1.5 flex flex-wrap items-end gap-3">
            <span className="num text-[clamp(1.75rem,5vw,2.5rem)] font-semibold leading-none text-white">
              {formatCurrency(portfolio.totalValue)}
            </span>
            <ChangePill value={portfolio.changePercent24h} className="mb-0.5" />
          </div>
        </div>

        <div className="mt-2 px-1">
          <PerformanceAreaChart
            data={performance}
            height={150}
            showAxes={false}
            ariaLabel="Sample portfolio value over the last 30 days"
          />
        </div>

        <ul className="divide-y divide-line border-t border-line">
          {featured.map((quote) => (
            <li key={quote.symbol} className="flex items-center gap-3 px-5 py-3">
              <AssetIcon
                symbol={quote.symbol}
                color={getAsset(quote.assetId)?.color ?? '#8C9188'}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{quote.symbol}</p>
                <p className="truncate text-[11px] text-muted">{quote.name}</p>
              </div>
              <Sparkline
                data={quote.sparkline}
                width={72}
                height={26}
                positive={quote.changePercent24h >= 0}
                className="hidden shrink-0 sm:block"
              />
              <div className="shrink-0 text-right">
                <p className="num text-sm text-white">{formatCurrency(quote.price)}</p>
                <ChangePill
                  value={quote.changePercent24h}
                  showBackground={false}
                  className="px-0 text-[11px]"
                />
              </div>
            </li>
          ))}
        </ul>

        {/*
          Footer strip. Low-value by design: it is the band the allocation card
          overhangs, so the overlap never covers a price or a holding.
        */}
        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3.5">
          <span className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-accent" />
            Simulated feed
          </span>
          <span className="text-[11px] text-muted">Demonstration only</span>
        </div>
      </motion.div>

      {/*
        Floating stat cards. Hidden below xl, where the panel has no gutters to
        hang them in. Each is placed over a low-density part of the panel — the
        chart band, or a corner it mostly overhangs — so none of them covers a
        figure the panel is there to show.
      */}
      <FloatingCard
        delay={0.45}
        className="absolute -left-12 top-[26%] hidden w-[176px] xl:block"
      >
        <div className="flex items-center gap-2 text-muted">
          <Activity className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
          <span className="whitespace-nowrap text-[10px] uppercase tracking-[0.14em]">
            Market move
          </span>
        </div>
        <p className="num mt-2 text-xl font-semibold text-white">+2.41%</p>
        <p className="mt-0.5 text-[11px] text-muted">BTC · 24 hours</p>
        <Sparkline data={marketQuotes[0].sparkline} width={144} height={26} className="mt-2" />
      </FloatingCard>

      {/* Overhangs the top-right corner; the header badge is hidden at this breakpoint */}
      <FloatingCard
        delay={0.6}
        className="absolute -right-8 -top-[86px] hidden w-[172px] xl:block"
      >
        <div className="flex items-center gap-2 text-muted">
          <ArrowUpRight className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          <span className="text-[10px] uppercase tracking-[0.14em]">Trading volume</span>
        </div>
        <p className="num mt-2 text-xl font-semibold text-white">$28.4B</p>
        <p className="mt-0.5 text-[11px] text-muted">24h across sample markets</p>
        <div className="mt-3 flex h-8 items-end gap-1" aria-hidden="true">
          {[42, 58, 35, 72, 48, 88, 64, 95, 55, 78].map((h, i) => (
            <span
              key={i}
              className="flex-1 rounded-sm bg-accent/60"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </FloatingCard>

      {/* Overhangs the bottom-right corner, clearing the asset rows above it */}
      <FloatingCard
        delay={0.75}
        className="absolute -right-10 -bottom-[86px] hidden w-[188px] xl:block"
      >
        <div className="flex items-center gap-2 text-muted">
          <PieChart className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          <span className="text-[10px] uppercase tracking-[0.14em]">Asset allocation</span>
        </div>
        <ul className="mt-2.5 space-y-1.5">
          {portfolio.holdings.slice(0, 3).map((holding) => (
            <li key={holding.symbol}>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-white/85">{holding.symbol}</span>
                <span className="num text-muted">{holding.allocation}%</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${Math.min(holding.allocation, 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </FloatingCard>
    </div>
  )
}
