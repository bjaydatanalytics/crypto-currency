import 'server-only'
import { and, asc, eq, lte, sql } from 'drizzle-orm'
import { db } from '@/db'
import { investments, type Investment } from '@/db/ledger-schema'
import { assets, investmentPlans, users } from '@/db/schema'
import { AuditAction, recordAudit } from './audit'
import {
  compareAmounts,
  ensureAccount,
  getPlatformBalance,
  getUserBalances,
  hasSufficientFunds,
  multiplyByPercent,
  negate,
  postTransaction,
} from './ledger'
import { sendTransactionNotice } from './mailer'
import { getMarketQuotes } from './market-service'
import type { RequestContext } from './session'

/**
 * Investment subscriptions and maturity.
 *
 * The product here promises a **contractual fixed return**: at maturity the
 * business owes the principal plus a stated percentage, whatever its own
 * performance was. Three properties make that safe to operate, and none of
 * them is optional.
 *
 * 1. **The principal is locked.** Subscribing moves funds from `user_available`
 *    to `user_locked`, exactly as a pending withdrawal does. Otherwise one
 *    balance could back an investment and a withdrawal simultaneously.
 *
 * 2. **Terms are frozen at subscription.** Rate, term, disclosure and the
 *    computed payout are copied onto the row. An operator editing a plan
 *    tomorrow cannot alter what somebody agreed to today.
 *
 * 3. **The return must be funded before it is paid.** Maturity debits
 *    `platform_treasury`, and this module refuses to mature a contract the
 *    treasury cannot cover. That refusal is the whole point: the alternative is
 *    a treasury that silently goes negative, which in plain terms means paying
 *    one customer's return out of another customer's deposit. The ledger would
 *    still balance; the business would be insolvent and nothing would say so.
 */

export class InvestmentError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'unknown_plan'
      | 'plan_unavailable'
      | 'no_promise'
      | 'unknown_asset'
      | 'below_minimum'
      | 'above_maximum'
      | 'insufficient_funds'
      | 'not_found'
      | 'wrong_status'
      | 'not_due'
      | 'treasury_short',
  ) {
    super(message)
    this.name = 'InvestmentError'
  }
}

/**
 * The payout owed on a principal.
 *
 * `per_term` applies the rate once over the whole term. `annual` pro-rates it
 * across the term's share of a 365-day year — so a 30-day plan at 12% annual
 * pays roughly 0.986%, not 12%. Getting this wrong in the generous direction is
 * how a platform accidentally promises twelve times what it meant to.
 */
export function computeReturn(
  principal: string,
  ratePercent: string,
  basis: 'per_term' | 'annual',
  durationDays: number,
): string {
  if (basis === 'per_term') return multiplyByPercent(principal, ratePercent)

  // Pro-rate the annual rate: rate * (days / 365), kept exact by scaling the
  // rate rather than the money.
  const scaled = (Number(ratePercent) * durationDays) / 365
  return multiplyByPercent(principal, scaled.toFixed(6))
}

export interface InvestmentView {
  id: string
  planId: string
  planName: string
  assetId: string
  assetSymbol: string
  principal: string
  fixedRatePercent: string
  rateBasis: string
  durationDays: number
  expectedReturn: string
  totalAtMaturity: string
  yieldSource: string
  riskDisclosure: string
  status: 'active' | 'matured' | 'cancelled'
  startedAt: string
  maturesAt: string
  maturedAt: string | null
  cancelledAt: string | null
  cancellationReason: string | null
  /** Whole days remaining, floored at zero. */
  daysRemaining: number
}

function toView(row: Investment, assetSymbol: string): InvestmentView {
  const now = Date.now()
  const remaining = Math.max(0, Math.ceil((row.maturesAt.getTime() - now) / 86_400_000))

  return {
    id: row.id,
    planId: row.planId,
    planName: row.planName,
    assetId: row.assetId,
    assetSymbol,
    principal: row.principal,
    fixedRatePercent: row.fixedRatePercent,
    rateBasis: row.rateBasis,
    durationDays: row.durationDays,
    expectedReturn: row.expectedReturn,
    totalAtMaturity: sumOf(row.principal, row.expectedReturn),
    yieldSource: row.yieldSource,
    riskDisclosure: row.riskDisclosure,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    maturesAt: row.maturesAt.toISOString(),
    maturedAt: row.maturedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancellationReason: row.cancellationReason,
    daysRemaining: row.status === 'active' ? remaining : 0,
  }
}

const SCALE = 18

function scaleToInt(value: string): bigint {
  const negative = value.startsWith('-')
  const [whole, fraction = ''] = value.replace('-', '').split('.')
  const scaled = BigInt(whole + fraction.padEnd(SCALE, '0').slice(0, SCALE))
  return negative ? -scaled : scaled
}

function intToDecimal(total: bigint): string {
  const negative = total < 0n
  const digits = (negative ? -total : total).toString().padStart(SCALE + 1, '0')
  const whole = digits.slice(0, digits.length - SCALE)
  const fraction = digits.slice(digits.length - SCALE).replace(/0+$/, '')
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`
}

/** Exact addition of signed decimal strings. */
function sumOf(a: string, b: string): string {
  return intToDecimal(scaleToInt(a) + scaleToInt(b))
}

/** Exact subtraction, which may legitimately go negative (a shortfall). */
function differenceOf(a: string, b: string): string {
  return intToDecimal(scaleToInt(a) - scaleToInt(b))
}

/* ------------------------------------------------------------------ */
/* Subscribing                                                         */
/* ------------------------------------------------------------------ */

export async function subscribeToPlan(input: {
  userId: string
  planId: string
  assetId: string
  amount: string
  idempotencyKey: string
  context?: RequestContext
}): Promise<InvestmentView> {
  const [plan] = await db
    .select()
    .from(investmentPlans)
    .where(eq(investmentPlans.id, input.planId))
    .limit(1)

  if (!plan) throw new InvestmentError('No plan with that id.', 'unknown_plan')
  if (!plan.published) {
    throw new InvestmentError('That plan is not open for subscription.', 'plan_unavailable')
  }

  // A plan with no rate, term or stated yield source cannot be subscribed to.
  // The database constraint blocks publishing such a plan; this covers the
  // path where one was published before the terms were completed.
  if (!plan.fixedRatePercent || !plan.durationDays || !plan.yieldSource) {
    throw new InvestmentError(
      'That plan has no complete terms — rate, duration and yield source are all required before anyone can subscribe.',
      'no_promise',
    )
  }

  const [asset] = await db.select().from(assets).where(eq(assets.id, input.assetId)).limit(1)
  if (!asset) throw new InvestmentError(`Unknown asset: ${input.assetId}`, 'unknown_asset')

  /* --- value the stake, for the plan's min/max in its own currency ---- */

  const market = await getMarketQuotes()
  const price = market.quotes.find((quote) => quote.assetId === input.assetId)?.price ?? null
  const usdValue = price === null ? null : Number(input.amount) * price

  if (plan.minimumAmount !== null) {
    if (usdValue === null) {
      throw new InvestmentError(
        `This plan has a minimum in ${plan.currency}, and there is no current price for ${asset.symbol} to check it against. Try again shortly.`,
        'below_minimum',
      )
    }
    if (usdValue < Number(plan.minimumAmount)) {
      throw new InvestmentError(
        `That is below the ${plan.minimumAmount} ${plan.currency} minimum for this plan.`,
        'below_minimum',
      )
    }
  }

  if (plan.maximumAmount !== null && usdValue !== null && usdValue > Number(plan.maximumAmount)) {
    throw new InvestmentError(
      `That is above the ${plan.maximumAmount} ${plan.currency} maximum for this plan.`,
      'above_maximum',
    )
  }

  /* --- funds check ---------------------------------------------------- */

  const balances = await getUserBalances(input.userId)
  const balance = balances.find((entry) => entry.assetId === input.assetId)

  if (!balance || !hasSufficientFunds(balance.available, input.amount)) {
    throw new InvestmentError(
      `Not enough available ${asset.symbol}. Funds already locked in another investment or a pending withdrawal cannot be used.`,
      'insufficient_funds',
    )
  }

  const expectedReturn = computeReturn(
    input.amount,
    plan.fixedRatePercent,
    plan.rateBasis as 'per_term' | 'annual',
    plan.durationDays,
  )

  const availableAccount = await ensureAccount(input.assetId, 'user_available', input.userId)
  const lockedAccount = await ensureAccount(input.assetId, 'user_locked', input.userId)

  const maturesAt = new Date(Date.now() + plan.durationDays * 86_400_000)

  const row = await db.transaction(async () => {
    const lockTransactionId = await postTransaction({
      type: 'investment_lock',
      idempotencyKey: `investment-lock:${input.idempotencyKey}`,
      description: `Lock ${input.amount} ${input.assetId} for ${plan.name}`,
      postings: [
        { accountId: availableAccount, assetId: input.assetId, amount: negate(input.amount) },
        { accountId: lockedAccount, assetId: input.assetId, amount: input.amount },
      ],
    })

    const [created] = await db
      .insert(investments)
      .values({
        userId: input.userId,
        planId: plan.id,
        assetId: input.assetId,
        principal: input.amount,
        planName: plan.name,
        fixedRatePercent: plan.fixedRatePercent!,
        rateBasis: plan.rateBasis,
        durationDays: plan.durationDays!,
        expectedReturn,
        yieldSource: plan.yieldSource!,
        riskDisclosure: plan.riskDisclosure,
        usdValueAtStart: usdValue === null ? null : usdValue.toFixed(2),
        priceAtStart: price === null ? null : String(price),
        status: 'active',
        lockTransactionId,
        maturesAt,
        idempotencyKey: input.idempotencyKey,
      })
      .returning()

    return created
  })

  await recordAudit({
    actorId: input.userId,
    actorRole: 'user',
    action: AuditAction.InvestmentOpened,
    targetType: 'investment',
    targetId: row.id,
    metadata: {
      planId: plan.id,
      planName: plan.name,
      assetId: input.assetId,
      principal: input.amount,
      fixedRatePercent: plan.fixedRatePercent,
      rateBasis: plan.rateBasis,
      durationDays: plan.durationDays,
      expectedReturn,
      maturesAt: maturesAt.toISOString(),
    },
    context: input.context,
  })

  return toView(row, asset.symbol)
}

/* ------------------------------------------------------------------ */
/* Maturity                                                           */
/* ------------------------------------------------------------------ */

/**
 * Pays out a matured investment: principal back, plus the promised return.
 *
 * One ledger transaction with four postings, balancing per asset:
 *
 *   user_locked      -principal      (the stake is released)
 *   user_available   +principal
 *   platform_treasury -return        (the business pays what it owes)
 *   user_available   +return
 *
 * Refuses when the treasury cannot cover the return. That refusal is not a
 * limitation to work around — it is the system telling you that you owe a
 * customer money you do not have. Fund the treasury and call again.
 */
export async function matureInvestment(
  investmentId: string,
  actor?: { id: string; context?: RequestContext },
): Promise<InvestmentView> {
  const [row] = await db.select().from(investments).where(eq(investments.id, investmentId)).limit(1)
  if (!row) throw new InvestmentError('No investment with that id.', 'not_found')

  if (row.status !== 'active') {
    throw new InvestmentError(`That investment is already ${row.status}.`, 'wrong_status')
  }
  if (row.maturesAt > new Date()) {
    throw new InvestmentError(
      `That investment matures at ${row.maturesAt.toISOString()}. Paying early would settle a contract before its term.`,
      'not_due',
    )
  }

  const treasury = await getPlatformBalance(row.assetId, 'platform_treasury')
  if (compareAmounts(treasury, row.expectedReturn) < 0) {
    throw new InvestmentError(
      `The treasury holds ${treasury} ${row.assetId.toUpperCase()} but owes ${row.expectedReturn} on this contract. ` +
        'Fund the treasury before maturing it — paying anyway would take the shortfall from other customers’ balances.',
      'treasury_short',
    )
  }

  const [asset] = await db.select().from(assets).where(eq(assets.id, row.assetId)).limit(1)

  const availableAccount = await ensureAccount(row.assetId, 'user_available', row.userId)
  const lockedAccount = await ensureAccount(row.assetId, 'user_locked', row.userId)
  const treasuryAccount = await ensureAccount(row.assetId, 'platform_treasury', null)

  const releaseTransactionId = await postTransaction({
    type: 'investment_return',
    idempotencyKey: `investment-mature:${row.idempotencyKey}`,
    description: `Mature ${row.planName}: ${row.principal} + ${row.expectedReturn} ${row.assetId}`,
    metadata: {
      investmentId: row.id,
      principal: row.principal,
      returnPaid: row.expectedReturn,
      ratePercent: row.fixedRatePercent,
      rateBasis: row.rateBasis,
    },
    createdBy: actor?.id,
    postings: [
      { accountId: lockedAccount, assetId: row.assetId, amount: negate(row.principal) },
      { accountId: availableAccount, assetId: row.assetId, amount: row.principal },
      { accountId: treasuryAccount, assetId: row.assetId, amount: negate(row.expectedReturn) },
      { accountId: availableAccount, assetId: row.assetId, amount: row.expectedReturn },
    ],
  })

  const [updated] = await db
    .update(investments)
    .set({ status: 'matured', maturedAt: new Date(), releaseTransactionId })
    .where(and(eq(investments.id, investmentId), eq(investments.status, 'active')))
    .returning()

  await recordAudit({
    actorId: actor?.id ?? null,
    actorRole: actor ? 'admin' : null,
    action: AuditAction.InvestmentMatured,
    targetType: 'investment',
    targetId: row.id,
    metadata: {
      userId: row.userId,
      principal: row.principal,
      returnPaid: row.expectedReturn,
      assetId: row.assetId,
      releaseTransactionId,
    },
    context: actor?.context,
  })

  const [owner] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, row.userId))
    .limit(1)

  if (owner) {
    await sendTransactionNotice({
      userId: row.userId,
      to: owner.email,
      kind: 'deposit',
      amount: sumOf(row.principal, row.expectedReturn),
      asset: row.assetId.toUpperCase(),
      network: `${row.planName} matured`,
    })
  }

  return toView(updated ?? row, asset?.symbol ?? row.assetId.toUpperCase())
}

/** Active contracts whose term has elapsed. Drives the maturity sweep. */
export async function listDueInvestments(limit = 100) {
  return db
    .select()
    .from(investments)
    .where(and(eq(investments.status, 'active'), lte(investments.maturesAt, new Date())))
    .orderBy(asc(investments.maturesAt))
    .limit(limit)
}

/**
 * Matures every contract that is due.
 *
 * Reports failures rather than throwing on the first one: a single underfunded
 * contract must not stop the others being paid, and the shortfall needs to be
 * visible as a list an operator can act on.
 */
export async function matureDueInvestments(
  actor?: { id: string; context?: RequestContext },
): Promise<{
  matured: string[]
  failed: Array<{ id: string; reason: string; code: string }>
}> {
  const due = await listDueInvestments()
  const matured: string[] = []
  const failed: Array<{ id: string; reason: string; code: string }> = []

  for (const row of due) {
    try {
      await matureInvestment(row.id, actor)
      matured.push(row.id)
    } catch (error) {
      failed.push({
        id: row.id,
        reason: error instanceof Error ? error.message : 'Unknown error',
        code: error instanceof InvestmentError ? error.code : 'unknown',
      })
    }
  }

  return { matured, failed }
}

/**
 * Cancels an active investment, returning the principal and paying no return.
 *
 * For the cases that do arise: a subscription made in error, or a contract the
 * operator must unwind. The principal goes back in full — keeping any part of
 * it would be a penalty nobody agreed to, and no early-exit terms exist.
 */
export async function cancelInvestment(
  investmentId: string,
  reason: string,
  actor: { id: string; role: 'user' | 'admin'; context?: RequestContext },
): Promise<InvestmentView> {
  const [row] = await db.select().from(investments).where(eq(investments.id, investmentId)).limit(1)
  if (!row) throw new InvestmentError('No investment with that id.', 'not_found')
  if (row.status !== 'active') {
    throw new InvestmentError(`That investment is already ${row.status}.`, 'wrong_status')
  }

  const availableAccount = await ensureAccount(row.assetId, 'user_available', row.userId)
  const lockedAccount = await ensureAccount(row.assetId, 'user_locked', row.userId)

  const releaseTransactionId = await postTransaction({
    type: 'investment_release',
    idempotencyKey: `investment-cancel:${row.idempotencyKey}`,
    description: `Cancel ${row.planName}: return ${row.principal} ${row.assetId}`,
    metadata: { investmentId: row.id, reason, returnPaid: '0' },
    createdBy: actor.id,
    postings: [
      { accountId: lockedAccount, assetId: row.assetId, amount: negate(row.principal) },
      { accountId: availableAccount, assetId: row.assetId, amount: row.principal },
    ],
  })

  const [updated] = await db
    .update(investments)
    .set({
      status: 'cancelled',
      cancelledAt: new Date(),
      cancellationReason: reason,
      releaseTransactionId,
    })
    .where(and(eq(investments.id, investmentId), eq(investments.status, 'active')))
    .returning()

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: AuditAction.InvestmentCancelled,
    targetType: 'investment',
    targetId: row.id,
    metadata: { userId: row.userId, principal: row.principal, reason },
    context: actor.context,
  })

  const [asset] = await db.select().from(assets).where(eq(assets.id, row.assetId)).limit(1)
  return toView(updated ?? row, asset?.symbol ?? row.assetId.toUpperCase())
}

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

export async function listUserInvestments(
  userId: string,
  status?: 'active' | 'matured' | 'cancelled',
): Promise<InvestmentView[]> {
  const conditions = [
    eq(investments.userId, userId),
    status ? eq(investments.status, status) : undefined,
  ].filter(Boolean)

  const rows = await db
    .select({ investment: investments, symbol: assets.symbol })
    .from(investments)
    .innerJoin(assets, eq(assets.id, investments.assetId))
    .where(and(...conditions))
    .orderBy(sql`${investments.startedAt} desc`)

  return rows.map(({ investment, symbol }) => toView(investment, symbol))
}

export interface AdminInvestmentView extends InvestmentView {
  userId: string
  userEmail: string
  userName: string
}

export async function listAllInvestments(
  status?: 'active' | 'matured' | 'cancelled',
): Promise<AdminInvestmentView[]> {
  const rows = await db
    .select({
      investment: investments,
      symbol: assets.symbol,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(investments)
    .innerJoin(assets, eq(assets.id, investments.assetId))
    .innerJoin(users, eq(users.id, investments.userId))
    .where(status ? eq(investments.status, status) : undefined)
    .orderBy(sql`${investments.startedAt} desc`)

  return rows.map(({ investment, symbol, email, firstName, lastName }) => ({
    ...toView(investment, symbol),
    userId: investment.userId,
    userEmail: email,
    userName: `${firstName} ${lastName}`,
  }))
}

/* ------------------------------------------------------------------ */
/* Treasury                                                            */
/* ------------------------------------------------------------------ */

/**
 * Records the business putting its own money in, so returns can be paid.
 *
 * Debits `external` and credits `platform_treasury` — the same shape as a
 * customer deposit, because that is what it is: money entering the platform
 * from outside. An operator must actually have moved the funds before
 * recording this, exactly as with a customer deposit.
 */
export async function fundTreasury(
  input: { assetId: string; amount: string; note?: string; idempotencyKey: string },
  actor: { id: string; context?: RequestContext },
): Promise<{ assetId: string; balance: string }> {
  const [asset] = await db.select().from(assets).where(eq(assets.id, input.assetId)).limit(1)
  if (!asset) throw new InvestmentError(`Unknown asset: ${input.assetId}`, 'unknown_asset')

  const treasuryAccount = await ensureAccount(input.assetId, 'platform_treasury', null)
  const externalAccount = await ensureAccount(input.assetId, 'external', null)

  await postTransaction({
    type: 'treasury_funding',
    idempotencyKey: `treasury-fund:${input.idempotencyKey}`,
    description: `Treasury funded with ${input.amount} ${input.assetId}`,
    metadata: { note: input.note, assetId: input.assetId, amount: input.amount },
    createdBy: actor.id,
    postings: [
      { accountId: externalAccount, assetId: input.assetId, amount: negate(input.amount) },
      { accountId: treasuryAccount, assetId: input.assetId, amount: input.amount },
    ],
  })

  await recordAudit({
    actorId: actor.id,
    actorRole: 'admin',
    action: AuditAction.TreasuryFunded,
    targetType: 'treasury',
    targetId: input.assetId,
    metadata: { amount: input.amount, note: input.note },
    context: actor.context,
  })

  return { assetId: input.assetId, balance: await getPlatformBalance(input.assetId, 'platform_treasury') }
}

export interface TreasuryPosition {
  assetId: string
  symbol: string
  /** What the treasury holds. */
  balance: string
  /** The sum of returns owed on every active contract in this asset. */
  committed: string
  /** balance − committed. Negative means the promises are not funded. */
  surplus: string
  funded: boolean
}

/**
 * Treasury solvency, per asset.
 *
 * `committed` is the total return owed on contracts that have not yet matured.
 * A negative `surplus` means the business has promised more than it holds — it
 * is not a warning about the future, it is a statement that the shortfall
 * already exists and will surface as a failed maturity on a specific date.
 */
export async function getTreasuryPositions(): Promise<TreasuryPosition[]> {
  const assetRows = await db.select().from(assets).orderBy(asc(assets.displayOrder))

  const commitments = await db
    .select({
      assetId: investments.assetId,
      owed: sql<string>`coalesce(sum(${investments.expectedReturn}), 0)::text`,
    })
    .from(investments)
    .where(eq(investments.status, 'active'))
    .groupBy(investments.assetId)

  const owedByAsset = new Map(commitments.map((entry) => [entry.assetId, entry.owed]))

  const positions = await Promise.all(
    assetRows.map(async (asset) => {
      const balance = await getPlatformBalance(asset.id, 'platform_treasury')
      const committed = owedByAsset.get(asset.id) ?? '0'
      const surplus = differenceOf(balance, committed)

      return {
        assetId: asset.id,
        symbol: asset.symbol,
        balance,
        committed,
        surplus,
        funded: compareAmounts(balance, committed) >= 0,
      }
    }),
  )

  // Only assets that matter: something held, or something owed.
  return positions.filter(
    (position) => position.balance !== '0' || position.committed !== '0',
  )
}
