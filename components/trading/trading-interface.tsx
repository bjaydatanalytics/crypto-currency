'use client'

import { useEffect, useMemo, useState } from 'react'
import { FlaskConical, TrendingDown, TrendingUp } from 'lucide-react'
import { PriceChart } from '@/components/charts/price-chart'
import { AssetIcon, ChangePill } from '@/components/ui/asset-icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { fetchCandles, listQuotes } from '@/lib/api/markets'
import { placeOrder } from '@/lib/api/trading'
import { getAsset } from '@/lib/mock-data'
import type { Candle, MarketQuote, OrderSide, OrderType, Timeframe } from '@/lib/types'
import { cn, formatCompact, formatCurrency } from '@/lib/utils'

const timeframes: Timeframe[] = ['1H', '4H', '1D', '1W', '1M']

const orderTypes = [
  { value: 'market', label: 'Market' },
  { value: 'limit', label: 'Limit' },
  { value: 'stop', label: 'Stop' },
]

/**
 * Trading interface.
 *
 * DEMO ONLY. `placeOrder` routes to the trading service, which in this build
 * returns `executed: false` and a message saying no order was sent anywhere.
 * The panel renders that message verbatim — it never shows a success state of
 * its own, because a confirmation for an order that was never placed would be
 * indistinguishable from a real fill to the person reading it.
 */
export function TradingInterface({
  initialSymbol = 'BTC',
  className,
}: {
  initialSymbol?: string
  className?: string
}) {
  const { toast } = useToast()

  const [quotes, setQuotes] = useState<MarketQuote[]>([])
  const [symbol, setSymbol] = useState(initialSymbol)
  const [timeframe, setTimeframe] = useState<Timeframe>('1D')
  const [candles, setCandles] = useState<Candle[] | null>(null)

  const [side, setSide] = useState<OrderSide>('buy')
  const [orderType, setOrderType] = useState<OrderType>('market')
  const [amount, setAmount] = useState('')
  const [limitPrice, setLimitPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const quote = useMemo(
    () => quotes.find((q) => q.symbol === symbol),
    [quotes, symbol],
  )

  useEffect(() => {
    let active = true
    listQuotes().then(({ data }) => {
      if (active) setQuotes(data)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    setCandles(null)
    fetchCandles(symbol, timeframe).then(({ data }) => {
      if (active) setCandles(data)
    })
    return () => {
      active = false
    }
  }, [symbol, timeframe])

  // A new market invalidates any price typed for the previous one
  useEffect(() => {
    setLimitPrice('')
    setResult(null)
  }, [symbol])

  const numericAmount = Number(amount)
  const estimatedTotal =
    quote && Number.isFinite(numericAmount) && numericAmount > 0
      ? numericAmount * (orderType === 'market' ? quote.price : Number(limitPrice) || quote.price)
      : 0

  const canSubmit =
    Number.isFinite(numericAmount) &&
    numericAmount > 0 &&
    (orderType === 'market' || Number(limitPrice) > 0)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit || !quote) return

    setSubmitting(true)
    setResult(null)

    const { data } = await placeOrder({
      symbol: `${symbol}/USDT`,
      side,
      type: orderType,
      amount: numericAmount,
      price: orderType === 'market' ? undefined : Number(limitPrice),
    })

    setSubmitting(false)
    setResult(data.message)
    toast({
      tone: 'warn',
      title: data.executed ? 'Order submitted' : 'Demo order — not executed',
      description: data.message,
    })
  }

  return (
    <div className={cn('grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]', className)}>
      {/* ---------------- Asset selector ---------------- */}
      <Card className="order-1 overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <h3 className="text-sm font-medium text-white">Markets</h3>
        </div>
        <ul className="max-h-[220px] overflow-y-auto xl:max-h-[520px]">
          {quotes.length === 0
            ? Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-3.5 flex-1" />
                </li>
              ))
            : quotes.map((item) => {
                const active = item.symbol === symbol
                return (
                  <li key={item.symbol}>
                    <button
                      type="button"
                      onClick={() => setSymbol(item.symbol)}
                      aria-current={active ? 'true' : undefined}
                      className={cn(
                        'flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left transition-colors',
                        active
                          ? 'border-accent bg-accent/[0.06]'
                          : 'border-transparent hover:bg-white/[0.03]',
                      )}
                    >
                      <AssetIcon
                        symbol={item.symbol}
                        color={getAsset(item.assetId)?.color ?? '#8C9188'}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">
                          {item.symbol}/USDT
                        </p>
                        <p className="num truncate text-xs text-muted">
                          {formatCurrency(item.price)}
                        </p>
                      </div>
                      <ChangePill
                        value={item.changePercent24h}
                        showBackground={false}
                        className="shrink-0 px-0 text-[11px]"
                      />
                    </button>
                  </li>
                )
              })}
        </ul>
      </Card>

      {/* ---------------- Chart ---------------- */}
      <Card className="order-3 overflow-hidden xl:order-2">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line p-4">
          <div className="flex items-center gap-3">
            {quote && (
              <AssetIcon
                symbol={quote.symbol}
                color={getAsset(quote.assetId)?.color ?? '#8C9188'}
              />
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white">{symbol}/USDT</h3>
                <Badge tone="warn" className="normal-case tracking-normal">
                  Demo
                </Badge>
              </div>
              {quote ? (
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="num text-sm text-white/90">{formatCurrency(quote.price)}</span>
                  <ChangePill value={quote.changePercent24h} showBackground={false} className="px-0" />
                </div>
              ) : (
                <Skeleton className="mt-1 h-4 w-28" />
              )}
            </div>
          </div>

          <div
            className="no-scrollbar flex gap-1 overflow-x-auto rounded-lg border border-line bg-base-800 p-1"
            role="group"
            aria-label="Chart timeframe"
          >
            {timeframes.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                aria-pressed={tf === timeframe}
                className={cn(
                  'num rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  tf === timeframe
                    ? 'bg-accent text-black'
                    : 'text-muted hover:bg-white/[0.05] hover:text-white',
                )}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        <div className="p-2 sm:p-4">
          {candles ? (
            <PriceChart
              candles={candles}
              timeframe={timeframe}
              ariaLabel={`Sample ${symbol} to USDT closing price over the ${timeframe} window`}
            />
          ) : (
            <Skeleton className="h-[340px] w-full rounded-xl" />
          )}
        </div>

        {quote && (
          <dl className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
            {[
              { label: '24h high', value: formatCurrency(quote.high24h) },
              { label: '24h low', value: formatCurrency(quote.low24h) },
              { label: '24h volume', value: formatCompact(quote.volume24h) },
              { label: 'Market cap', value: formatCompact(quote.marketCap) },
            ].map((stat) => (
              <div key={stat.label} className="bg-surface px-4 py-3">
                <dt className="text-[11px] uppercase tracking-wider text-muted">{stat.label}</dt>
                <dd className="num mt-1 text-sm text-white">{stat.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      {/* ---------------- Order panel ---------------- */}
      <Card className="order-2 xl:order-3">
        <div className="flex items-center justify-between gap-3 border-b border-line p-4">
          <h3 className="text-sm font-medium text-white">Place order</h3>
          <Badge tone="warn" dot className="normal-case tracking-normal">
            Demo trading
          </Badge>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <div
            className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-base-800 p-1"
            role="group"
            aria-label="Order side"
          >
            {(['buy', 'sell'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSide(value)}
                aria-pressed={side === value}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold uppercase tracking-wide transition-colors',
                  side === value
                    ? value === 'buy'
                      ? 'bg-positive/20 text-positive'
                      : 'bg-negative/20 text-negative'
                    : 'text-muted hover:text-white',
                )}
              >
                {value === 'buy' ? (
                  <TrendingUp className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <TrendingDown className="h-4 w-4" aria-hidden="true" />
                )}
                {value}
              </button>
            ))}
          </div>

          <Select
            label="Order type"
            options={orderTypes}
            value={orderType}
            onChange={(e) => setOrderType(e.target.value as OrderType)}
          />

          {orderType !== 'market' && (
            <Input
              label={orderType === 'limit' ? 'Limit price' : 'Stop price'}
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              placeholder="0.00"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              suffix="USDT"
            />
          )}

          <Input
            label="Amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            suffix={symbol}
          />

          <dl className="space-y-2 rounded-xl border border-line bg-base-800 p-3.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Est. total</dt>
              <dd className="num text-white">
                {estimatedTotal > 0 ? formatCurrency(estimatedTotal) : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Fee</dt>
              <dd className="text-xs italic text-muted">Set by operator</dd>
            </div>
          </dl>

          <Button type="submit" fullWidth size="lg" loading={submitting} disabled={!canSubmit}>
            Place Demo Order
          </Button>

          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
            <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" aria-hidden="true" />
            Demo environment. Orders are not routed to any venue, no position is opened and no
            funds move.
          </p>

          {result && (
            <p
              role="status"
              className="rounded-lg border border-warn/25 bg-warn/[0.07] p-3 text-xs leading-relaxed text-white/80"
            >
              {result}
            </p>
          )}
        </form>
      </Card>
    </div>
  )
}
