import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  ledgerAccounts,
  ledgerEntries,
  ledgerTransactions,
  ledgerTxTypeEnum,
  type LedgerAccount,
} from '@/db/ledger-schema'

/**
 * Ledger service.
 *
 * The only sanctioned way to change a balance. Everything here is built around
 * one invariant, checked in code before every write:
 *
 *   for each asset in a transaction, the signed entry amounts sum to exactly 0
 *
 * If that holds for every transaction, it holds for the whole ledger, and the
 * platform's books always balance. If it is ever bypassed, money appears from
 * nowhere or vanishes — and you find out during a withdrawal, from a customer.
 *
 * Amounts are handled as strings and summed in Postgres `numeric`. JavaScript
 * numbers are IEEE-754 doubles and cannot represent 0.1 exactly, let alone 18
 * decimal places of wei.
 */

export class LedgerError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'unbalanced'
      | 'insufficient_funds'
      | 'account_missing'
      | 'duplicate'
      | 'invalid_amount',
  ) {
    super(message)
    this.name = 'LedgerError'
  }
}

export interface PostingInput {
  accountId: string
  assetId: string
  /** Signed decimal string. Positive credits, negative debits. */
  amount: string
}

export interface PostTransactionInput {
  /**
   * Derived from the database enum rather than restated here.
   *
   * Listing the types by hand meant adding one to the schema and finding out
   * at the call site that this union had not been updated — the two drifted
   * silently until something failed to compile somewhere unrelated.
   */
  type: (typeof ledgerTxTypeEnum.enumValues)[number]
  /** Must be stable for a given real-world event — this is the replay guard. */
  idempotencyKey: string
  description?: string
  metadata?: Record<string, unknown>
  createdBy?: string
  postings: PostingInput[]
}

/** Rejects anything Postgres `numeric` would not accept, before it reaches SQL. */
function assertValidAmount(amount: string) {
  if (!/^-?\d+(\.\d+)?$/.test(amount)) {
    throw new LedgerError(`Invalid amount: ${amount}`, 'invalid_amount')
  }
}

/**
 * Sums signed decimal strings exactly, without floating point.
 *
 * Scales every value to a common integer representation and uses BigInt, so
 * 0.1 + 0.2 is 0.3 here, not 0.30000000000000004.
 */
function sumExact(amounts: string[]): string {
  const SCALE = 18
  let total = 0n

  for (const amount of amounts) {
    assertValidAmount(amount)
    const negative = amount.startsWith('-')
    const [whole, fraction = ''] = amount.replace('-', '').split('.')
    const scaled = BigInt(whole + fraction.padEnd(SCALE, '0').slice(0, SCALE))
    total += negative ? -scaled : scaled
  }

  return total.toString()
}

function isZero(amounts: string[]): boolean {
  return sumExact(amounts) === '0'
}

/**
 * Posts a balanced transaction.
 *
 * Everything happens in one database transaction: either the whole set of
 * entries lands or none of it does. A partial post would leave the ledger
 * permanently out of balance with no way to tell which half was real.
 */
export async function postTransaction(input: PostTransactionInput): Promise<string> {
  if (input.postings.length < 2) {
    throw new LedgerError('A transaction needs at least two postings.', 'unbalanced')
  }

  // Balance is checked per asset: a transaction touching BTC and USDT must
  // balance within each, not merely in aggregate — those are not interchangeable.
  const byAsset = new Map<string, string[]>()
  for (const posting of input.postings) {
    assertValidAmount(posting.amount)
    const list = byAsset.get(posting.assetId) ?? []
    list.push(posting.amount)
    byAsset.set(posting.assetId, list)
  }

  for (const [assetId, amounts] of byAsset) {
    if (!isZero(amounts)) {
      throw new LedgerError(
        `Postings for ${assetId} do not sum to zero (got ${sumExact(amounts)} at 1e-18 scale).`,
        'unbalanced',
      )
    }
  }

  return db.transaction(async (tx) => {
    const [transaction] = await tx
      .insert(ledgerTransactions)
      .values({
        type: input.type,
        idempotencyKey: input.idempotencyKey,
        description: input.description,
        metadata: input.metadata,
        createdBy: input.createdBy,
      })
      // A retry of the same real-world event is a no-op, not a second posting.
      .onConflictDoNothing({ target: ledgerTransactions.idempotencyKey })
      .returning()

    if (!transaction) {
      throw new LedgerError(
        `A transaction with idempotency key "${input.idempotencyKey}" already exists.`,
        'duplicate',
      )
    }

    await tx.insert(ledgerEntries).values(
      input.postings.map((posting) => ({
        transactionId: transaction.id,
        accountId: posting.accountId,
        assetId: posting.assetId,
        amount: posting.amount,
      })),
    )

    return transaction.id
  })
}

/**
 * Current balance of an account, computed from its entries.
 *
 * Deliberately not a stored column. A stored balance can drift from its
 * entries through a partial failure or a stray UPDATE, and once it does there
 * is no way to know which is right. Summing is always correct by construction.
 *
 * At high entry volume this becomes the thing to optimise — with a periodically
 * materialised snapshot plus entries since, reconciled against a full sum. Do
 * not replace it with a mutable column.
 */
export async function getBalance(accountId: string): Promise<string> {
  const [row] = await db
    .select({
      balance: sql<string>`coalesce(sum(${ledgerEntries.amount}), 0)::text`,
    })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.accountId, accountId))

  return row?.balance ?? '0'
}

export interface AssetBalance {
  assetId: string
  available: string
  locked: string
}

/** Every balance for a user, grouped by asset, in a single query. */
export async function getUserBalances(userId: string): Promise<AssetBalance[]> {
  const rows = await db
    .select({
      assetId: ledgerAccounts.assetId,
      type: ledgerAccounts.type,
      balance: sql<string>`coalesce(sum(${ledgerEntries.amount}), 0)::text`,
    })
    .from(ledgerAccounts)
    .leftJoin(ledgerEntries, eq(ledgerEntries.accountId, ledgerAccounts.id))
    .where(eq(ledgerAccounts.userId, userId))
    .groupBy(ledgerAccounts.assetId, ledgerAccounts.type)

  const byAsset = new Map<string, AssetBalance>()
  for (const row of rows) {
    const entry = byAsset.get(row.assetId) ?? {
      assetId: row.assetId,
      available: '0',
      locked: '0',
    }
    if (row.type === 'user_available') entry.available = row.balance
    if (row.type === 'user_locked') entry.locked = row.balance
    byAsset.set(row.assetId, entry)
  }

  return [...byAsset.values()]
}

/**
 * Finds or creates an account.
 *
 * Creation is idempotent via the unique index, so two concurrent first-time
 * deposits cannot produce two "available" accounts and split the balance.
 */
export async function ensureAccount(
  assetId: string,
  type: LedgerAccount['type'],
  userId: string | null = null,
): Promise<string> {
  const existing = await db
    .select({ id: ledgerAccounts.id })
    .from(ledgerAccounts)
    .where(
      and(
        eq(ledgerAccounts.assetId, assetId),
        eq(ledgerAccounts.type, type),
        userId === null
          ? sql`${ledgerAccounts.userId} is null`
          : eq(ledgerAccounts.userId, userId),
      ),
    )
    .limit(1)

  if (existing[0]) return existing[0].id

  const [created] = await db
    .insert(ledgerAccounts)
    .values({ assetId, type, userId })
    .onConflictDoNothing()
    .returning({ id: ledgerAccounts.id })

  if (created) return created.id

  // Lost the race — the concurrent insert won, so read its row.
  const [row] = await db
    .select({ id: ledgerAccounts.id })
    .from(ledgerAccounts)
    .where(
      and(
        eq(ledgerAccounts.assetId, assetId),
        eq(ledgerAccounts.type, type),
        userId === null
          ? sql`${ledgerAccounts.userId} is null`
          : eq(ledgerAccounts.userId, userId),
      ),
    )
    .limit(1)

  if (!row) throw new LedgerError('Could not resolve ledger account.', 'account_missing')
  return row.id
}

/** Flips the sign of a signed decimal string. */
export function negate(amount: string): string {
  assertValidAmount(amount)
  if (amount === '0') return '0'
  return amount.startsWith('-') ? amount.slice(1) : `-${amount}`
}

/**
 * Multiplies a decimal amount by a percentage, exactly.
 *
 * Used to compute a promised return, so it cannot go through a float: a
 * rounding error here is money somebody is owed. Both operands are scaled to
 * integers, multiplied with BigInt, and the result truncated back to 18 decimal
 * places.
 *
 * Truncation rather than rounding is deliberate and documented: at 1e-18 of a
 * unit the difference is immaterial to any real amount, and a fixed rule that
 * never varies is worth more than a marginally fairer one that differs between
 * call sites. The figure is computed once at subscription and stored, so
 * whatever this returns is what the customer is owed — it is never recomputed
 * against a later version of this function.
 */
export function multiplyByPercent(amount: string, percent: string): string {
  assertValidAmount(amount)

  const SCALE = 18
  const toScaled = (value: string, scale: number): bigint => {
    const negative = value.startsWith('-')
    const [whole, fraction = ''] = value.replace('-', '').split('.')
    const scaled = BigInt(whole + fraction.padEnd(scale, '0').slice(0, scale))
    return negative ? -scaled : scaled
  }

  // percent is scaled to 6dp: 12.5% -> 12500000
  const scaledAmount = toScaled(amount, SCALE)
  const scaledPercent = toScaled(percent, 6)

  // (amount * percent) / 100, keeping the 18dp scale on the result.
  const product = (scaledAmount * scaledPercent) / (100n * 10n ** 6n)

  const negative = product < 0n
  const digits = (negative ? -product : product).toString().padStart(SCALE + 1, '0')
  const whole = digits.slice(0, digits.length - SCALE)
  const fraction = digits.slice(digits.length - SCALE).replace(/0+$/, '')

  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`
}

/**
 * The balance of a platform account — one with no owning user.
 *
 * Needed before paying a promised return: the treasury must actually hold the
 * money. Without this check the ledger would still balance (it always does),
 * but the platform account would simply go negative, which is the accounting
 * signature of paying returns out of other customers' deposits.
 */
export async function getPlatformBalance(
  assetId: string,
  type: 'platform_fee' | 'platform_liability' | 'platform_treasury',
): Promise<string> {
  const [row] = await db
    .select({ balance: sql<string>`coalesce(sum(${ledgerEntries.amount}), 0)::text` })
    .from(ledgerAccounts)
    .leftJoin(ledgerEntries, eq(ledgerEntries.accountId, ledgerAccounts.id))
    .where(
      and(
        eq(ledgerAccounts.assetId, assetId),
        eq(ledgerAccounts.type, type),
        sql`${ledgerAccounts.userId} is null`,
      ),
    )

  return row?.balance ?? '0'
}

/** Compares two signed decimal strings exactly. Returns -1, 0 or 1. */
export function compareAmounts(a: string, b: string): number {
  const difference = sumExact([a, negate(b)])
  if (difference === '0') return 0
  return difference.startsWith('-') ? -1 : 1
}

/** True when `available` covers `amount`. Used before locking funds. */
export function hasSufficientFunds(available: string, amount: string): boolean {
  return compareAmounts(available, amount) >= 0
}

/**
 * Whole-ledger integrity check.
 *
 * Every asset must sum to zero across all accounts. Run it on a schedule and
 * alert on any non-zero result — that is your early warning that something has
 * written entries outside `postTransaction`.
 */
export async function verifyLedgerIntegrity(): Promise<
  Array<{ assetId: string; imbalance: string }>
> {
  const rows = await db
    .select({
      assetId: ledgerEntries.assetId,
      total: sql<string>`sum(${ledgerEntries.amount})::text`,
    })
    .from(ledgerEntries)
    .groupBy(ledgerEntries.assetId)
    .having(sql`sum(${ledgerEntries.amount}) <> 0`)

  return rows.map((row) => ({ assetId: row.assetId, imbalance: row.total }))
}
