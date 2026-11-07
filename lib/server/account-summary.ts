/**
 * The headline figures on the customer dashboard.
 *
 * Every number here is read from the ledger and the deposit / withdrawal /
 * investment tables. Nothing is estimated, projected or sampled — a figure the
 * customer reads as their balance has to be the balance.
 *
 * Amounts are stored in *asset units* (BTC, ETH, …) because that is what was
 * actually moved. The dashboard presents one combined USD figure, so each
 * per-asset total is converted at the current quote. That conversion is for
 * display only: it never writes back, and `pricesStale` travels with the
 * result so the UI can say when a price is old rather than quietly showing a
 * number that is no longer true. When an asset has no quote at all its units
 * are reported in `unpriced` instead of being silently counted as zero.
 */

import { and, eq, gte, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  deposits,
  investments,
  ledgerAccounts,
  ledgerEntries,
  ledgerTransactions,
  withdrawals,
} from '@/db/ledger-schema'
import type { AccountSummary, MoneyTotal } from '@/lib/account-summary-types'
import { getUserBalances } from '@/lib/server/ledger'
import { getMarketQuotes } from '@/lib/server/market-service'

export type { AccountSummary, MoneyTotal } from '@/lib/account-summary-types'

/* ------------------------------------------------------------------ */
/* Status groupings                                                    */
/* ------------------------------------------------------------------ */

/**
 * Which statuses count as money that actually arrived or left.
 *
 * A deposit is only real once it is `credited`; everything before that is an
 * on-chain transfer we have seen but not yet accepted. Showing a `detected`
 * deposit as a successful one would tell the customer they can spend funds
 * that are not yet theirs.
 */
const DEPOSIT_SUCCESS = ['credited'] as const
const DEPOSIT_PENDING = ['detected', 'confirming'] as const
const DEPOSIT_REJECTED = ['failed', 'rejected'] as const

/**
 * `approved` and `broadcasting` are still pending from the customer's side:
 * the funds are locked but have not left the platform, and the request can
 * still fail. Only `completed` means the payout went out.
 */
const WITHDRAWAL_SUCCESS = ['completed'] as const
const WITHDRAWAL_PENDING = ['requested', 'pending_approval', 'approved', 'broadcasting'] as const
const WITHDRAWAL_REJECTED = ['failed', 'rejected'] as const

/* ------------------------------------------------------------------ */
/* Conversion                                                          */
/* ------------------------------------------------------------------ */

type UnitsByAsset = Map<string, string>

/**
 * Converts per-asset unit totals to a single USD figure.
 *
 * `Number()` is safe here and only here: this value is for display, never for
 * a balance check or a ledger posting. Amounts stay decimal strings everywhere
 * that correctness depends on them.
 */
function toUsd(units: UnitsByAsset, priceByAsset: Map<string, number>): MoneyTotal {
  let usd = 0
  const unpriced: { assetId: string; units: string }[] = []

  for (const [assetId, amount] of units) {
    if (Number(amount) === 0) continue
    const price = priceByAsset.get(assetId)
    if (price === undefined) {
      unpriced.push({ assetId, units: amount })
      continue
    }
    usd += Number(amount) * price
  }

  return { usd, unpriced }
}

/** Collapses `[{assetId, total}]` rows into a map, summing duplicates. */
function groupUnits(rows: { assetId: string; total: string | null }[]): UnitsByAsset {
  const map: UnitsByAsset = new Map()
  for (const row of rows) {
    const previous = Number(map.get(row.assetId) ?? '0')
    map.set(row.assetId, String(previous + Number(row.total ?? '0')))
  }
  return map
}

/* ------------------------------------------------------------------ */
/* Query                                                               */
/* ------------------------------------------------------------------ */

export async function getAccountSummary(userId: string): Promise<AccountSummary> {
  const [balances, market, depositRows, withdrawalRows, investmentRows] = await Promise.all([
    getUserBalances(userId),
    getMarketQuotes(),

    // One grouped read per table rather than one per status bucket.
    db
      .select({
        assetId: deposits.assetId,
        status: deposits.status,
        total: sql<string>`coalesce(sum(${deposits.amount}), 0)::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(deposits)
      .where(eq(deposits.userId, userId))
      .groupBy(deposits.assetId, deposits.status),

    db
      .select({
        assetId: withdrawals.assetId,
        status: withdrawals.status,
        total: sql<string>`coalesce(sum(${withdrawals.amount}), 0)::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(withdrawals)
      .where(eq(withdrawals.userId, userId))
      .groupBy(withdrawals.assetId, withdrawals.status),

    db
      .select({
        assetId: investments.assetId,
        status: investments.status,
        principal: sql<string>`coalesce(sum(${investments.principal}), 0)::text`,
        // Only counted as earned once the contract has actually matured.
        earned: sql<string>`coalesce(sum(${investments.expectedReturn}) filter (where ${investments.status} = 'matured'), 0)::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(investments)
      .where(eq(investments.userId, userId))
      .groupBy(investments.assetId, investments.status),
  ])

  const priceByAsset = new Map(market.quotes.map((quote) => [quote.assetId, quote.price]))

  /* --- wallets ----------------------------------------------------- */

  const available = groupUnits(balances.map((b) => ({ assetId: b.assetId, total: b.available })))
  const locked = groupUnits(balances.map((b) => ({ assetId: b.assetId, total: b.locked })))

  /* --- deposits ---------------------------------------------------- */

  const depositsIn = (statuses: readonly string[]) =>
    groupUnits(depositRows.filter((row) => statuses.includes(row.status)))

  /* --- withdrawals -------------------------------------------------- */

  const withdrawalsIn = (statuses: readonly string[]) =>
    groupUnits(withdrawalRows.filter((row) => statuses.includes(row.status)))

  /* --- investments -------------------------------------------------- */

  const investmentsIn = (statuses: readonly string[]) =>
    groupUnits(
      investmentRows
        .filter((row) => statuses.includes(row.status))
        .map((row) => ({ assetId: row.assetId, total: row.principal })),
    )

  const interestEarned = groupUnits(
    investmentRows.map((row) => ({ assetId: row.assetId, total: row.earned })),
  )

  /**
   * Stale when something the customer holds has no live price behind it. A
   * provider outage must not silently turn a funded account into "0.00 USD".
   */
  const heldAssets = new Set([...available.keys(), ...locked.keys()])
  const pricesStale =
    market.quotes.some((quote) => quote.stale) ||
    [...heldAssets].some((assetId) => Number(available.get(assetId) ?? 0) !== 0 && !priceByAsset.has(assetId))

  return {
    currency: 'USD',
    wallets: {
      deposit: toUsd(available, priceByAsset),
      interest: toUsd(interestEarned, priceByAsset),
      locked: toUsd(locked, priceByAsset),
    },
    deposits: {
      successful: toUsd(depositsIn(DEPOSIT_SUCCESS), priceByAsset),
      submitted: toUsd(groupUnits(depositRows), priceByAsset),
      pending: toUsd(depositsIn(DEPOSIT_PENDING), priceByAsset),
      rejected: toUsd(depositsIn(DEPOSIT_REJECTED), priceByAsset),
      count: depositRows.reduce((sum, row) => sum + row.count, 0),
    },
    withdrawals: {
      successful: toUsd(withdrawalsIn(WITHDRAWAL_SUCCESS), priceByAsset),
      submitted: toUsd(groupUnits(withdrawalRows), priceByAsset),
      pending: toUsd(withdrawalsIn(WITHDRAWAL_PENDING), priceByAsset),
      rejected: toUsd(withdrawalsIn(WITHDRAWAL_REJECTED), priceByAsset),
      count: withdrawalRows.reduce((sum, row) => sum + row.count, 0),
    },
    investments: {
      total: toUsd(
        groupUnits(investmentRows.map((r) => ({ assetId: r.assetId, total: r.principal }))),
        priceByAsset,
      ),
      completed: toUsd(investmentsIn(['matured']), priceByAsset),
      running: toUsd(investmentsIn(['active']), priceByAsset),
      interests: toUsd(interestEarned, priceByAsset),
      activeCount: investmentRows
        .filter((row) => row.status === 'active')
        .reduce((sum, row) => sum + row.count, 0),
    },
    pricesStale,
  }
}

/* ------------------------------------------------------------------ */
/* ROI series                                                          */
/* ------------------------------------------------------------------ */

/**
 * Daily returns credited to a customer over a trailing window.
 *
 * Read from the ledger rather than from the investments table, because the
 * ledger is where a return actually lands — an `investment_return` posting
 * into the customer's `user_available` account. A contract whose payout was
 * refused for want of treasury funds has no entry here, and correctly shows
 * no return on that day.
 *
 * Every day in the window is present, including the zero ones. Omitting empty
 * days would let a chart draw a straight line between two distant points and
 * imply earnings that never happened.
 */
export async function getRoiSeries(
  userId: string,
  days = 30,
): Promise<{ date: string; value: number }[]> {
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  since.setUTCDate(since.getUTCDate() - (days - 1))

  const [rows, market] = await Promise.all([
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${ledgerEntries.createdAt} at time zone 'utc'), 'YYYY-MM-DD')`,
        assetId: ledgerEntries.assetId,
        total: sql<string>`coalesce(sum(${ledgerEntries.amount}), 0)::text`,
      })
      .from(ledgerEntries)
      .innerJoin(ledgerTransactions, eq(ledgerTransactions.id, ledgerEntries.transactionId))
      .innerJoin(ledgerAccounts, eq(ledgerAccounts.id, ledgerEntries.accountId))
      .where(
        and(
          eq(ledgerAccounts.userId, userId),
          eq(ledgerAccounts.type, 'user_available'),
          inArray(ledgerTransactions.type, ['investment_return']),
          gte(ledgerEntries.createdAt, since),
        ),
      )
      .groupBy(sql`1`, ledgerEntries.assetId),
    getMarketQuotes(),
  ])

  const priceByAsset = new Map(market.quotes.map((quote) => [quote.assetId, quote.price]))

  const usdByDay = new Map<string, number>()
  for (const row of rows) {
    const price = priceByAsset.get(row.assetId)
    // An unpriced asset contributes nothing rather than a guessed figure.
    if (price === undefined) continue
    usdByDay.set(row.day, (usdByDay.get(row.day) ?? 0) + Number(row.total) * price)
  }

  const series: { date: string; value: number }[] = []
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(since)
    date.setUTCDate(since.getUTCDate() + offset)
    const key = date.toISOString().slice(0, 10)
    series.push({ date: key, value: usdByDay.get(key) ?? 0 })
  }

  return series
}
