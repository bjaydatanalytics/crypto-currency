/**
 * Shape of the customer dashboard's headline figures.
 *
 * Kept in its own module, free of any database import, so client components
 * can type against it without dragging the Drizzle driver into the browser
 * bundle. The server implementation lives in `lib/server/account-summary.ts`.
 */

/** A USD total, plus any units that could not be priced. */
export interface MoneyTotal {
  /** USD value of every priced asset in this bucket. */
  usd: number
  /** Assets with no current quote, reported rather than counted as zero. */
  unpriced: { assetId: string; units: string }[]
}

/** The four figures shown for a money-movement card. */
export interface MovementTotals {
  successful: MoneyTotal
  submitted: MoneyTotal
  pending: MoneyTotal
  rejected: MoneyTotal
  count: number
}

export interface AccountSummary {
  currency: 'USD'
  /**
   * The two wallet figures the dashboard shows side by side.
   *
   * IMPORTANT: these are not two separate pots of money. `deposit` is the
   * spendable balance right now; `interest` is the lifetime total of returns
   * already paid, which was credited into that same spendable balance when
   * each contract matured. Adding them together double-counts.
   */
  wallets: {
    /** Spendable balance — ledger `user_available`, valued in USD. */
    deposit: MoneyTotal
    /** Cumulative returns paid to date. Already included in `deposit`. */
    interest: MoneyTotal
    /** Principal currently locked in open contracts or pending withdrawals. */
    locked: MoneyTotal
  }
  deposits: MovementTotals
  withdrawals: MovementTotals
  investments: {
    /** Principal across every contract ever opened. */
    total: MoneyTotal
    /** Principal in contracts that have matured. */
    completed: MoneyTotal
    /** Principal in contracts still running. */
    running: MoneyTotal
    /** Returns already paid on matured contracts. */
    interests: MoneyTotal
    activeCount: number
  }
  /** True when no live price was available for at least one asset held. */
  pricesStale: boolean
}

const EMPTY: MoneyTotal = { usd: 0, unpriced: [] }

const EMPTY_MOVEMENT: MovementTotals = {
  successful: EMPTY,
  submitted: EMPTY,
  pending: EMPTY,
  rejected: EMPTY,
  count: 0,
}

/**
 * The zero summary.
 *
 * Used when no backend is configured. Zero is not sample data — it is what an
 * account with nothing behind it actually holds — so the UI presents it as a
 * real figure rather than flagging it as a simulation.
 */
export function emptyAccountSummary(): AccountSummary {
  return {
    currency: 'USD',
    wallets: { deposit: EMPTY, interest: EMPTY, locked: EMPTY },
    deposits: EMPTY_MOVEMENT,
    withdrawals: EMPTY_MOVEMENT,
    investments: {
      total: EMPTY,
      completed: EMPTY,
      running: EMPTY,
      interests: EMPTY,
      activeCount: 0,
    },
    pricesStale: false,
  }
}
