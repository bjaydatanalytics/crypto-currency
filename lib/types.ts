/**
 * Domain model for the platform.
 *
 * These types are the contract between the UI and the data layer. Mock data in
 * `lib/mock-data.ts` and the service layer in `lib/api/*` both satisfy them, so
 * swapping mocks for a real backend is a change of implementation only.
 */

/* ------------------------------------------------------------------ */
/* User & auth                                                         */
/* ------------------------------------------------------------------ */

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected'
export type UserRole = 'user' | 'admin'

export interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl?: string
  role: UserRole
  verification: VerificationStatus
  twoFactorEnabled: boolean
  createdAt: string
  lastLoginAt?: string
  country?: string
  phone?: string
}

export interface Session {
  id: string
  device: string
  browser: string
  location: string
  ipAddress: string
  lastActive: string
  current: boolean
}

export interface LoginEvent {
  id: string
  timestamp: string
  location: string
  ipAddress: string
  device: string
  status: 'success' | 'failed'
}

/* ------------------------------------------------------------------ */
/* Markets                                                             */
/* ------------------------------------------------------------------ */

export interface Asset {
  id: string
  /** Ticker, e.g. BTC */
  symbol: string
  name: string
  /** Short hex colour used for charts and asset chips */
  color: string
  decimals: number
  /** Chain / network label shown in wallet screens */
  network?: string
}

export interface MarketQuote {
  assetId: string
  symbol: string
  name: string
  price: number
  change24h: number
  changePercent24h: number
  high24h: number
  low24h: number
  volume24h: number
  marketCap: number
  /** Compact price series for sparklines — oldest first */
  sparkline: number[]
  updatedAt: string
}

export type Timeframe = '1H' | '4H' | '1D' | '1W' | '1M'

export interface Candle {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface PricePoint {
  time: string
  value: number
}

/* ------------------------------------------------------------------ */
/* Portfolio & wallet                                                  */
/* ------------------------------------------------------------------ */

export interface Holding {
  assetId: string
  symbol: string
  name: string
  color: string
  /** Units of the asset held */
  amount: number
  price: number
  value: number
  changePercent24h: number
  /** Share of total portfolio value, 0–100 */
  allocation: number
}

export interface Portfolio {
  totalValue: number
  change24h: number
  changePercent24h: number
  availableBalance: number
  investedAmount: number
  holdings: Holding[]
  performance: PricePoint[]
}

export interface WalletBalance {
  assetId: string
  symbol: string
  name: string
  color: string
  network?: string
  available: number
  locked: number
  usdValue: number
  /** Present only once a real custody backend supplies it */
  depositAddress?: string
}

/* ------------------------------------------------------------------ */
/* Investment plans                                                    */
/* ------------------------------------------------------------------ */

export type PlanTier = 'starter' | 'advanced' | 'pro'

/**
 * A plan describes the *service tier* a user subscribes to.
 *
 * It deliberately has no "return", "profit" or "yield" field: rates of return
 * are not something the frontend may assert. Any performance figure must come
 * from the backend, be sourced from real activity, and ship with a disclosure.
 */
export interface InvestmentPlan {
  id: string
  tier: PlanTier
  name: string
  summary: string
  /** Configured by the backend; null until an operator sets it */
  minimumAmount: number | null
  maximumAmount: number | null
  /** Platform fee as a percentage of the managed amount */
  fee: number | null
  /** Term in days; null means open-ended */
  duration: number | null
  currency: string
  features: string[]
  /** Plain-language description of the risks of this tier. Required. */
  riskDisclosure: string
  popular?: boolean
  /**
   * The contractually promised return, or null when the plan promises none.
   *
   * Never render this without `rateBasis`. "8%" on a 90-day plan means two very
   * different things per-term versus annual, and the ambiguity always reads in
   * the seller's favour.
   */
  fixedRatePercent?: number | null
  rateBasis?: 'per_term' | 'annual'
  /** Where the money to pay the return comes from. Required to publish a rate. */
  yieldSource?: string | null
}

export type InvestmentStatus = 'active' | 'completed' | 'pending' | 'cancelled'

export interface Investment {
  id: string
  planId: string
  planName: string
  amount: number
  currency: string
  startDate: string
  endDate: string | null
  status: InvestmentStatus
  /** Percent of the term elapsed, 0–100 */
  progress: number
}

/* ------------------------------------------------------------------ */
/* Transactions                                                        */
/* ------------------------------------------------------------------ */

export type TransactionType = 'deposit' | 'withdrawal' | 'trade' | 'transfer'
export type TransactionStatus = 'completed' | 'pending' | 'failed'

export interface Transaction {
  id: string
  type: TransactionType
  assetId: string
  symbol: string
  amount: number
  usdValue: number
  status: TransactionStatus
  date: string
  /** Free-text detail, e.g. "Bought BTC with USDT" */
  description?: string
  fee?: number
  /** Only ever populated by a real backend — never fabricated in the UI */
  reference?: string
}

export type OrderSide = 'buy' | 'sell'
export type OrderType = 'market' | 'limit' | 'stop'

export interface OrderRequest {
  symbol: string
  side: OrderSide
  type: OrderType
  amount: number
  price?: number
}

export interface OrderResult {
  /** False whenever the platform is in demo mode */
  executed: boolean
  demo: boolean
  message: string
  order: OrderRequest & { id: string; createdAt: string }
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export type NotificationKind = 'security' | 'transaction' | 'market' | 'system'

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  date: string
  read: boolean
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export interface AdminStats {
  totalUsers: number
  activeUsers: number
  pendingVerification: number
  transactions30d: number
  deposits30d: number
  withdrawals30d: number
  activePlans: number
}

export interface AdminUserRow {
  id: string
  name: string
  email: string
  verification: VerificationStatus
  status: 'active' | 'suspended'
  joined: string
}

/* ------------------------------------------------------------------ */
/* Service-layer helpers                                               */
/* ------------------------------------------------------------------ */

/** Uniform envelope returned by every function in `lib/api/*`. */
export interface ApiResult<T> {
  data: T
  /** True when the payload came from local mock data rather than a backend. */
  isMock: boolean
}

export interface Paginated<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
}
