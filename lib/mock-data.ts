/**
 * Mock data for the prototype.
 *
 * EVERYTHING IN THIS FILE IS SAMPLE DATA FOR VISUAL DEMONSTRATION ONLY.
 * Prices, balances, transactions and investments below are invented for layout
 * purposes. They are not market data, not a record of any real activity, and
 * must not be presented to end users as either. Replace this module with real
 * API responses via `lib/api/*` before launch.
 *
 * All values are deterministic (fixed constants + a seeded PRNG) so that the
 * server render and the client hydration agree.
 */

import { generateSeries } from './utils'
import type {
  AdminStats,
  AdminUserRow,
  Asset,
  Candle,
  Investment,
  InvestmentPlan,
  LoginEvent,
  MarketQuote,
  Portfolio,
  PricePoint,
  Session,
  Timeframe,
  Transaction,
  User,
  WalletBalance,
} from './types'

/** Fixed clock for the demo dataset — keeps every rendered date stable. */
const ANCHOR = new Date('2026-09-23T12:00:00.000Z')

function daysAgo(n: number) {
  return new Date(ANCHOR.getTime() - n * 86_400_000).toISOString()
}
function hoursAgo(n: number) {
  return new Date(ANCHOR.getTime() - n * 3_600_000).toISOString()
}
function daysAhead(n: number) {
  return new Date(ANCHOR.getTime() + n * 86_400_000).toISOString()
}

/**
 * Rescales a generated walk so its final value equals `target`.
 *
 * Multiplying the whole series keeps the shape intact. Overwriting just the
 * last point instead would draw a vertical spike into the chart wherever the
 * walk had drifted, which reads as a rendering fault rather than a price.
 */
function scaleSeriesTo(series: number[], target: number, decimals: number): number[] {
  const last = series[series.length - 1]
  if (!last) return series
  const factor = target / last
  return series.map((value, i) =>
    i === series.length - 1 ? target : Number((value * factor).toFixed(decimals)),
  )
}

/* ------------------------------------------------------------------ */
/* Assets                                                              */
/* ------------------------------------------------------------------ */

export const assets: Asset[] = [
  { id: 'btc', symbol: 'BTC', name: 'Bitcoin', color: '#F7931A', decimals: 8, network: 'Bitcoin' },
  { id: 'eth', symbol: 'ETH', name: 'Ethereum', color: '#8A92B2', decimals: 18, network: 'Ethereum' },
  { id: 'sol', symbol: 'SOL', name: 'Solana', color: '#14F195', decimals: 9, network: 'Solana' },
  { id: 'usdt', symbol: 'USDT', name: 'Tether', color: '#26A17B', decimals: 6, network: 'Ethereum (ERC-20)' },
  { id: 'bnb', symbol: 'BNB', name: 'BNB', color: '#F3BA2F', decimals: 18, network: 'BNB Smart Chain' },
  { id: 'xrp', symbol: 'XRP', name: 'XRP', color: '#23292F', decimals: 6, network: 'XRP Ledger' },
]

export function getAsset(id: string) {
  return assets.find((a) => a.id === id || a.symbol.toLowerCase() === id.toLowerCase())
}

/* ------------------------------------------------------------------ */
/* Market quotes (SAMPLE)                                              */
/* ------------------------------------------------------------------ */

interface QuoteSeed {
  id: string
  price: number
  changePercent24h: number
  volume24h: number
  marketCap: number
  seed: number
  volatility: number
}

const quoteSeeds: QuoteSeed[] = [
  { id: 'btc', price: 67420.35, changePercent24h: 2.41, volume24h: 28_400_000_000, marketCap: 1_328_000_000_000, seed: 11, volatility: 0.012 },
  { id: 'eth', price: 3284.12, changePercent24h: 1.86, volume24h: 14_100_000_000, marketCap: 394_000_000_000, seed: 23, volatility: 0.016 },
  { id: 'sol', price: 168.44, changePercent24h: -1.23, volume24h: 3_240_000_000, marketCap: 78_200_000_000, seed: 37, volatility: 0.024 },
  { id: 'bnb', price: 592.78, changePercent24h: 0.74, volume24h: 1_820_000_000, marketCap: 86_400_000_000, seed: 41, volatility: 0.014 },
  { id: 'xrp', price: 0.6142, changePercent24h: -0.58, volume24h: 1_140_000_000, marketCap: 34_100_000_000, seed: 53, volatility: 0.02 },
  { id: 'usdt', price: 1.0, changePercent24h: 0.01, volume24h: 46_800_000_000, marketCap: 118_000_000_000, seed: 67, volatility: 0.0006 },
]

export const marketQuotes: MarketQuote[] = quoteSeeds.map((seed) => {
  const raw = generateSeries(seed.seed, 28, seed.price * 0.97, seed.volatility)
  // Land the series on the headline price so card and sparkline agree.
  // Scale the whole walk rather than overwriting the last point, which would
  // leave a vertical spike wherever the walk had drifted away from the price.
  const sparkline = scaleSeriesTo(raw, seed.price, seed.price < 10 ? 4 : 2)
  const asset = assets.find((a) => a.id === seed.id)!

  const change24h = (seed.price * seed.changePercent24h) / 100

  return {
    assetId: asset.id,
    symbol: asset.symbol,
    name: asset.name,
    price: seed.price,
    change24h,
    changePercent24h: seed.changePercent24h,
    high24h: Number((seed.price * 1.018).toFixed(seed.price < 10 ? 4 : 2)),
    low24h: Number((seed.price * 0.978).toFixed(seed.price < 10 ? 4 : 2)),
    volume24h: seed.volume24h,
    marketCap: seed.marketCap,
    sparkline,
    updatedAt: ANCHOR.toISOString(),
  }
})

export function getQuote(symbol: string) {
  return marketQuotes.find((q) => q.symbol.toLowerCase() === symbol.toLowerCase())
}

/** Candles for the trading view. Deterministic per symbol + timeframe. */
export function generateCandles(symbol: string, timeframe: Timeframe): Candle[] {
  const quote = getQuote(symbol) ?? marketQuotes[0]
  const config: Record<Timeframe, { points: number; stepMs: number; vol: number }> = {
    '1H': { points: 60, stepMs: 60_000, vol: 0.0016 },
    '4H': { points: 48, stepMs: 300_000, vol: 0.003 },
    '1D': { points: 48, stepMs: 1_800_000, vol: 0.005 },
    '1W': { points: 56, stepMs: 10_800_000, vol: 0.011 },
    '1M': { points: 60, stepMs: 43_200_000, vol: 0.018 },
  }
  const { points, stepMs, vol } = config[timeframe]
  const seedBase = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const series = scaleSeriesTo(
    generateSeries(seedBase + timeframe.length * 13, points, quote.price * 0.985, vol),
    quote.price,
    quote.price < 10 ? 4 : 2,
  )

  return series.map((close, i) => {
    const prev = i === 0 ? close : series[i - 1]
    const open = prev
    const high = Math.max(open, close) * (1 + vol / 2)
    const low = Math.min(open, close) * (1 - vol / 2)
    const dp = quote.price < 10 ? 4 : 2
    return {
      time: new Date(ANCHOR.getTime() - (points - 1 - i) * stepMs).toISOString(),
      open: Number(open.toFixed(dp)),
      high: Number(high.toFixed(dp)),
      low: Number(low.toFixed(dp)),
      close: Number(close.toFixed(dp)),
      volume: Math.round(quote.volume24h / points / 1000),
    }
  })
}

/* ------------------------------------------------------------------ */
/* User (SAMPLE)                                                       */
/* ------------------------------------------------------------------ */

export const demoUser: User = {
  id: 'usr_demo_001',
  firstName: 'Alex',
  lastName: 'Rivera',
  email: 'alex.rivera@example.com',
  role: 'user',
  verification: 'verified',
  twoFactorEnabled: false,
  createdAt: daysAgo(214),
  lastLoginAt: hoursAgo(3),
  country: 'United Kingdom',
  phone: '+44 •••• ••7420',
}

export const demoSessions: Session[] = [
  {
    id: 'ses_1',
    device: 'MacBook Pro',
    browser: 'Chrome 129',
    location: 'London, United Kingdom',
    ipAddress: '81.•••.•••.24',
    lastActive: hoursAgo(0.1),
    current: true,
  },
  {
    id: 'ses_2',
    device: 'iPhone 15',
    browser: 'Safari Mobile',
    location: 'London, United Kingdom',
    ipAddress: '81.•••.•••.77',
    lastActive: hoursAgo(9),
    current: false,
  },
  {
    id: 'ses_3',
    device: 'Windows PC',
    browser: 'Edge 128',
    location: 'Manchester, United Kingdom',
    ipAddress: '92.•••.•••.13',
    lastActive: daysAgo(4),
    current: false,
  },
]

export const demoLoginHistory: LoginEvent[] = [
  { id: 'lg_1', timestamp: hoursAgo(3), location: 'London, United Kingdom', ipAddress: '81.•••.•••.24', device: 'Chrome · macOS', status: 'success' },
  { id: 'lg_2', timestamp: hoursAgo(28), location: 'London, United Kingdom', ipAddress: '81.•••.•••.77', device: 'Safari · iOS', status: 'success' },
  { id: 'lg_3', timestamp: daysAgo(3), location: 'Manchester, United Kingdom', ipAddress: '92.•••.•••.13', device: 'Edge · Windows', status: 'success' },
  { id: 'lg_4', timestamp: daysAgo(6), location: 'Unknown', ipAddress: '45.•••.•••.201', device: 'Unknown browser', status: 'failed' },
  { id: 'lg_5', timestamp: daysAgo(11), location: 'London, United Kingdom', ipAddress: '81.•••.•••.24', device: 'Chrome · macOS', status: 'success' },
]

/* ------------------------------------------------------------------ */
/* Portfolio (SAMPLE)                                                  */
/* ------------------------------------------------------------------ */

const holdingSeeds: Array<{ id: string; amount: number }> = [
  { id: 'btc', amount: 0.4182 },
  { id: 'eth', amount: 3.92 },
  { id: 'sol', amount: 48.5 },
  { id: 'usdt', amount: 4820 },
  { id: 'bnb', amount: 6.4 },
]

const holdings = holdingSeeds.map(({ id, amount }) => {
  const quote = marketQuotes.find((q) => q.assetId === id)!
  const asset = assets.find((a) => a.id === id)!
  return {
    assetId: id,
    symbol: asset.symbol,
    name: asset.name,
    color: asset.color,
    amount,
    price: quote.price,
    value: amount * quote.price,
    changePercent24h: quote.changePercent24h,
    allocation: 0, // filled below
  }
})

const totalValue = holdings.reduce((sum, h) => sum + h.value, 0)
holdings.forEach((h) => {
  h.allocation = Number(((h.value / totalValue) * 100).toFixed(2))
})

const performanceSeries: PricePoint[] = scaleSeriesTo(
  generateSeries(91, 90, totalValue * 0.82, 0.018),
  Number(totalValue.toFixed(2)),
  2,
).map((value, i, arr) => ({
  time: daysAgo(arr.length - 1 - i),
  value,
}))

export const demoPortfolio: Portfolio = {
  totalValue: Number(totalValue.toFixed(2)),
  change24h: Number((totalValue * 0.0187).toFixed(2)),
  changePercent24h: 1.87,
  availableBalance: 4820,
  investedAmount: Number((totalValue - 4820).toFixed(2)),
  holdings,
  performance: performanceSeries,
}

/* ------------------------------------------------------------------ */
/* Wallet (SAMPLE)                                                     */
/* ------------------------------------------------------------------ */

export const demoWallets: WalletBalance[] = [
  { assetId: 'btc', symbol: 'BTC', name: 'Bitcoin', color: '#F7931A', network: 'Bitcoin', available: 0.4182, locked: 0, usdValue: 0.4182 * 67420.35 },
  { assetId: 'eth', symbol: 'ETH', name: 'Ethereum', color: '#8A92B2', network: 'Ethereum', available: 3.72, locked: 0.2, usdValue: 3.92 * 3284.12 },
  { assetId: 'usdt', symbol: 'USDT', name: 'Tether', color: '#26A17B', network: 'Ethereum (ERC-20)', available: 4820, locked: 0, usdValue: 4820 },
  { assetId: 'sol', symbol: 'SOL', name: 'Solana', color: '#14F195', network: 'Solana', available: 48.5, locked: 0, usdValue: 48.5 * 168.44 },
]

/* ------------------------------------------------------------------ */
/* Investments (SAMPLE)                                                */
/* ------------------------------------------------------------------ */

export const demoInvestments: Investment[] = [
  { id: 'inv_1', planId: 'plan_advanced', planName: 'Advanced', amount: 5000, currency: 'USD', startDate: daysAgo(64), endDate: daysAhead(26), status: 'active', progress: 71 },
  { id: 'inv_2', planId: 'plan_starter', planName: 'Starter', amount: 1200, currency: 'USD', startDate: daysAgo(30), endDate: daysAhead(60), status: 'active', progress: 33 },
  { id: 'inv_3', planId: 'plan_pro', planName: 'Pro', amount: 12000, currency: 'USD', startDate: daysAgo(190), endDate: daysAgo(10), status: 'completed', progress: 100 },
  { id: 'inv_4', planId: 'plan_starter', planName: 'Starter', amount: 800, currency: 'USD', startDate: daysAgo(240), endDate: daysAgo(60), status: 'completed', progress: 100 },
  { id: 'inv_5', planId: 'plan_advanced', planName: 'Advanced', amount: 3500, currency: 'USD', startDate: daysAhead(2), endDate: daysAhead(92), status: 'pending', progress: 0 },
]

/* ------------------------------------------------------------------ */
/* Transactions (SAMPLE)                                               */
/* ------------------------------------------------------------------ */

export const demoTransactions: Transaction[] = [
  { id: 'tx_01', type: 'deposit', assetId: 'usdt', symbol: 'USDT', amount: 2500, usdValue: 2500, status: 'completed', date: hoursAgo(5), description: 'Deposit received', fee: 0 },
  { id: 'tx_02', type: 'trade', assetId: 'btc', symbol: 'BTC', amount: 0.0412, usdValue: 2777.72, status: 'completed', date: hoursAgo(9), description: 'Bought BTC with USDT', fee: 2.78 },
  { id: 'tx_03', type: 'withdrawal', assetId: 'eth', symbol: 'ETH', amount: 0.5, usdValue: 1642.06, status: 'pending', date: hoursAgo(22), description: 'Withdrawal requested', fee: 1.64 },
  { id: 'tx_04', type: 'transfer', assetId: 'sol', symbol: 'SOL', amount: 12, usdValue: 2021.28, status: 'completed', date: daysAgo(2), description: 'Transfer to savings', fee: 0 },
  { id: 'tx_05', type: 'trade', assetId: 'sol', symbol: 'SOL', amount: 18.4, usdValue: 3099.3, status: 'completed', date: daysAgo(3), description: 'Bought SOL with USDT', fee: 3.1 },
  { id: 'tx_06', type: 'deposit', assetId: 'btc', symbol: 'BTC', amount: 0.15, usdValue: 10113.05, status: 'completed', date: daysAgo(5), description: 'Deposit received', fee: 0 },
  { id: 'tx_07', type: 'withdrawal', assetId: 'usdt', symbol: 'USDT', amount: 1000, usdValue: 1000, status: 'failed', date: daysAgo(7), description: 'Withdrawal cancelled by user', fee: 0 },
  { id: 'tx_08', type: 'trade', assetId: 'eth', symbol: 'ETH', amount: 1.2, usdValue: 3940.94, status: 'completed', date: daysAgo(9), description: 'Sold ETH for USDT', fee: 3.94 },
  { id: 'tx_09', type: 'transfer', assetId: 'usdt', symbol: 'USDT', amount: 500, usdValue: 500, status: 'completed', date: daysAgo(12), description: 'Internal transfer', fee: 0 },
  { id: 'tx_10', type: 'deposit', assetId: 'eth', symbol: 'ETH', amount: 2.0, usdValue: 6568.24, status: 'completed', date: daysAgo(15), description: 'Deposit received', fee: 0 },
  { id: 'tx_11', type: 'trade', assetId: 'bnb', symbol: 'BNB', amount: 6.4, usdValue: 3793.79, status: 'completed', date: daysAgo(18), description: 'Bought BNB with USDT', fee: 3.79 },
  { id: 'tx_12', type: 'withdrawal', assetId: 'btc', symbol: 'BTC', amount: 0.02, usdValue: 1348.41, status: 'completed', date: daysAgo(24), description: 'Withdrawal processed', fee: 1.35 },
]

/* ------------------------------------------------------------------ */
/* Admin (SAMPLE)                                                      */
/* ------------------------------------------------------------------ */

export const adminStats: AdminStats = {
  totalUsers: 12_480,
  activeUsers: 3_912,
  pendingVerification: 214,
  transactions30d: 48_320,
  deposits30d: 9_640,
  withdrawals30d: 4_180,
  activePlans: 3,
}

export const adminUsers: AdminUserRow[] = [
  { id: 'usr_1041', name: 'Alex Rivera', email: 'alex.rivera@example.com', verification: 'verified', status: 'active', joined: daysAgo(214) },
  { id: 'usr_1042', name: 'Priya Nandan', email: 'priya.n@example.com', verification: 'pending', status: 'active', joined: daysAgo(12) },
  { id: 'usr_1043', name: 'Tomas Lindqvist', email: 't.lindqvist@example.com', verification: 'verified', status: 'active', joined: daysAgo(96) },
  { id: 'usr_1044', name: 'Mei Chen', email: 'mei.chen@example.com', verification: 'unverified', status: 'active', joined: daysAgo(3) },
  { id: 'usr_1045', name: 'Daniel Okafor', email: 'd.okafor@example.com', verification: 'verified', status: 'suspended', joined: daysAgo(310) },
  { id: 'usr_1046', name: 'Sofia Marchetti', email: 's.marchetti@example.com', verification: 'rejected', status: 'active', joined: daysAgo(28) },
  { id: 'usr_1047', name: 'Jonas Weber', email: 'j.weber@example.com', verification: 'pending', status: 'active', joined: daysAgo(6) },
  { id: 'usr_1048', name: 'Amara Diallo', email: 'a.diallo@example.com', verification: 'verified', status: 'active', joined: daysAgo(142) },
]

/** Platform-wide volume series for the admin overview chart. */
export const adminVolumeSeries: PricePoint[] = generateSeries(77, 30, 820_000, 0.06).map(
  (value, i, arr) => ({ time: daysAgo(arr.length - 1 - i), value: Math.round(value) }),
)
