import 'server-only'
import { and, count, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { deposits, investments, withdrawals } from '@/db/ledger-schema'
import { investmentPlans, supportTickets, users } from '@/db/schema'
import { platformDepositAddresses } from '@/db/ledger-schema'
import { getTreasuryPositions, type TreasuryPosition } from './investments'
import { verifyLedgerIntegrity } from './ledger'

/**
 * The admin overview.
 *
 * Built as a **work queue**, not a vanity dashboard. The old version showed
 * invented user counts and a mock volume chart, which meant the landing page an
 * operator saw first was the least true page in the product — and it threw a
 * 500 in production, because the endpoints it called were never written.
 *
 * Every figure here is counted from the database. The ordering reflects what
 * actually costs somebody something if it is missed:
 *
 *   - a deposit recorded but not credited is a customer whose money arrived
 *     and whose balance still reads zero
 *   - a matured contract not paid is a debt already overdue
 *   - an unfunded treasury is a promise that will fail on a known date
 *   - an unbalanced ledger means the books no longer add up
 *
 * Counts, not amounts, for the queue: "three deposits waiting" is actionable,
 * whereas a total in mixed assets needs conversion this code deliberately does
 * not do.
 */

export interface AdminQueue {
  /** Identity decisions outstanding. Nobody in here can deposit. */
  awaitingKyc: number
  /** Recorded, not yet credited. */
  pendingDeposits: number
  /** Of those, past their confirmation threshold and creditable now. */
  creditableDeposits: number
  /** Requested, awaiting an approval decision. Funds already locked. */
  pendingWithdrawals: number
  /** Approved but not yet paid — somebody must send the money. */
  approvedUnpaid: number
  /** Term elapsed, payout owed. */
  maturedInvestments: number
  /** Customers waiting on a reply. */
  awaitingSupport: number
}

export interface AdminTotals {
  users: number
  newUsers7d: number
  verifiedUsers: number
  activeInvestments: number
  publishedPlans: number
  draftPlans: number
  activeReceivingAddresses: number
}

export interface DailyActivity {
  /** ISO date, YYYY-MM-DD. */
  date: string
  depositsCredited: number
  withdrawalsPaid: number
}

export interface RecentUser {
  id: string
  name: string
  email: string
  verification: string
  joined: string
}

export interface AdminOverview {
  queue: AdminQueue
  totals: AdminTotals
  treasury: { solvent: boolean; positions: TreasuryPosition[] }
  /** `balanced: false` means entries were written outside `postTransaction`. */
  ledger: { balanced: boolean; imbalances: Array<{ assetId: string; imbalance: string }> }
  activity: DailyActivity[]
  recentUsers: RecentUser[]
  /** True when nothing in the queue needs attention. */
  clear: boolean
}

const DAY_MS = 86_400_000

function isoDay(value: Date): string {
  return value.toISOString().slice(0, 10)
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS)

  const [
    userRows,
    kycRows,
    depositRows,
    withdrawalRows,
    investmentRows,
    supportRows,
    planRows,
    addressRows,
    treasuryPositions,
    imbalances,
    creditedSeries,
    paidSeries,
    recent,
  ] = await Promise.all([
    db
      .select({
        total: count(),
        recent: sql<number>`count(*) filter (where ${users.createdAt} >= ${sevenDaysAgo})::int`,
        verified: sql<number>`count(*) filter (where ${users.kycStatus} = 'verified')::int`,
      })
      .from(users),

    // Both states block a deposit, so both belong in the queue: "pending" is a
    // submission awaiting review, "unverified" is somebody who never submitted.
    db
      .select({ value: count() })
      .from(users)
      .where(inArray(users.kycStatus, ['pending', 'unverified'])),

    db
      .select({
        pending: count(),
        creditable: sql<number>`count(*) filter (
          where ${deposits.confirmations} >= ${deposits.requiredConfirmations}
        )::int`,
      })
      .from(deposits)
      .where(inArray(deposits.status, ['detected', 'confirming'])),

    db
      .select({
        pendingApproval: sql<number>`count(*) filter (where ${withdrawals.status} = 'pending_approval')::int`,
        approvedUnpaid: sql<number>`count(*) filter (where ${withdrawals.status} in ('approved', 'broadcasting'))::int`,
      })
      .from(withdrawals),

    db
      .select({
        active: count(),
        due: sql<number>`count(*) filter (where ${investments.maturesAt} <= ${now})::int`,
      })
      .from(investments)
      .where(eq(investments.status, 'active')),

    db
      .select({ value: count() })
      .from(supportTickets)
      .where(eq(supportTickets.status, 'awaiting_support')),

    db
      .select({
        published: sql<number>`count(*) filter (where ${investmentPlans.published})::int`,
        drafts: sql<number>`count(*) filter (where not ${investmentPlans.published})::int`,
      })
      .from(investmentPlans),

    db
      .select({ value: count() })
      .from(platformDepositAddresses)
      .where(eq(platformDepositAddresses.status, 'active')),

    getTreasuryPositions(),
    verifyLedgerIntegrity(),

    // Daily counts over the window. Gaps are filled below rather than in SQL —
    // a generate_series join reads worse than the loop it replaces.
    db
      .select({
        day: sql<string>`to_char(${deposits.creditedAt}, 'YYYY-MM-DD')`,
        value: count(),
      })
      .from(deposits)
      .where(and(eq(deposits.status, 'credited'), gte(deposits.creditedAt, thirtyDaysAgo)))
      .groupBy(sql`to_char(${deposits.creditedAt}, 'YYYY-MM-DD')`),

    db
      .select({
        day: sql<string>`to_char(${withdrawals.completedAt}, 'YYYY-MM-DD')`,
        value: count(),
      })
      .from(withdrawals)
      .where(and(eq(withdrawals.status, 'completed'), gte(withdrawals.completedAt, thirtyDaysAgo)))
      .groupBy(sql`to_char(${withdrawals.completedAt}, 'YYYY-MM-DD')`),

    db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        kycStatus: users.kycStatus,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(6),
  ])

  const creditedByDay = new Map(creditedSeries.map((row) => [row.day, row.value]))
  const paidByDay = new Map(paidSeries.map((row) => [row.day, row.value]))

  const activity: DailyActivity[] = []
  for (let i = 29; i >= 0; i -= 1) {
    const day = isoDay(new Date(now.getTime() - i * DAY_MS))
    activity.push({
      date: day,
      depositsCredited: creditedByDay.get(day) ?? 0,
      withdrawalsPaid: paidByDay.get(day) ?? 0,
    })
  }

  const queue: AdminQueue = {
    awaitingKyc: kycRows[0]?.value ?? 0,
    pendingDeposits: depositRows[0]?.pending ?? 0,
    creditableDeposits: depositRows[0]?.creditable ?? 0,
    pendingWithdrawals: withdrawalRows[0]?.pendingApproval ?? 0,
    approvedUnpaid: withdrawalRows[0]?.approvedUnpaid ?? 0,
    maturedInvestments: investmentRows[0]?.due ?? 0,
    awaitingSupport: supportRows[0]?.value ?? 0,
  }

  return {
    queue,
    totals: {
      users: userRows[0]?.total ?? 0,
      newUsers7d: userRows[0]?.recent ?? 0,
      verifiedUsers: userRows[0]?.verified ?? 0,
      activeInvestments: investmentRows[0]?.active ?? 0,
      publishedPlans: planRows[0]?.published ?? 0,
      draftPlans: planRows[0]?.drafts ?? 0,
      activeReceivingAddresses: addressRows[0]?.value ?? 0,
    },
    treasury: {
      solvent: treasuryPositions.every((position) => position.funded),
      positions: treasuryPositions,
    },
    ledger: { balanced: imbalances.length === 0, imbalances },
    activity,
    recentUsers: recent.map((row) => ({
      id: row.id,
      name: `${row.firstName} ${row.lastName}`,
      email: row.email,
      verification: row.kycStatus,
      joined: row.createdAt.toISOString(),
    })),
    clear: Object.values(queue).every((value) => value === 0),
  }
}
