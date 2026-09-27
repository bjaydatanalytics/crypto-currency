import { desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { ledgerAccounts, ledgerEntries, ledgerTransactions } from '@/db/ledger-schema'
import { ok, withErrorHandling } from '@/lib/server/api'
import { requireVerifiedUser } from '@/lib/server/guard'

/**
 * Transaction history, read from the ledger.
 *
 * Every row here is backed by immutable ledger entries, so the history and the
 * balance are the same data viewed two ways and cannot disagree. Internal
 * lock/unlock movements are excluded — they are bookkeeping, not something the
 * customer did.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const guard = await requireVerifiedUser()
  if (!guard.ok) return guard.response

  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1)
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') ?? '10') || 10))

  const rows = await db
    .select({
      id: ledgerTransactions.id,
      type: ledgerTransactions.type,
      description: ledgerTransactions.description,
      createdAt: ledgerTransactions.createdAt,
      assetId: ledgerEntries.assetId,
      amount: ledgerEntries.amount,
    })
    .from(ledgerEntries)
    .innerJoin(ledgerAccounts, eq(ledgerEntries.accountId, ledgerAccounts.id))
    .innerJoin(ledgerTransactions, eq(ledgerEntries.transactionId, ledgerTransactions.id))
    .where(
      sql`${ledgerAccounts.userId} = ${guard.user.id}
          and ${ledgerAccounts.type} = 'user_available'
          and ${ledgerTransactions.type} not in ('withdrawal_lock', 'withdrawal_unlock')`,
    )
    .orderBy(desc(ledgerTransactions.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const [totals] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(ledgerEntries)
    .innerJoin(ledgerAccounts, eq(ledgerEntries.accountId, ledgerAccounts.id))
    .innerJoin(ledgerTransactions, eq(ledgerEntries.transactionId, ledgerTransactions.id))
    .where(
      sql`${ledgerAccounts.userId} = ${guard.user.id}
          and ${ledgerAccounts.type} = 'user_available'
          and ${ledgerTransactions.type} not in ('withdrawal_lock', 'withdrawal_unlock')`,
    )

  return ok({
    items: rows.map((row) => ({
      id: row.id,
      type: row.type,
      assetId: row.assetId,
      symbol: row.assetId.toUpperCase(),
      // Sign comes from the ledger entry: negative left the account.
      amount: row.amount,
      direction: row.amount.startsWith('-') ? 'out' : 'in',
      description: row.description,
      status: 'completed' as const,
      date: row.createdAt.toISOString(),
    })),
    page,
    pageSize,
    total: totals?.value ?? 0,
  })
})
