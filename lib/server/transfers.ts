import 'server-only'
import { and, desc, eq, gt, isNull, lte, sql } from 'drizzle-orm'
import { db } from '@/db'
import { assets, users } from '@/db/schema'
import { deposits, withdrawalAddresses, withdrawals } from '@/db/ledger-schema'
import { getNetwork, networkLabel } from '@/lib/deposit-networks'
import { assertValidAddress, AddressValidationError, checkAddressTag } from './address-validation'
import { AuditAction, recordAudit } from './audit'
import { defaultConfirmationsFor } from './confirmations'
import { DepositAddressNotAssignedError, getUserDepositAddress } from './deposit-addresses'
import {
  ensureAccount,
  getUserBalances,
  hasSufficientFunds,
  negate,
  postTransaction,
} from './ledger'
import { sendSecurityAlert, sendTransactionNotice } from './mailer'
import type { RequestContext } from './session'

/**
 * Deposit and withdrawal orchestration.
 *
 * Sits between the operator's actions and the ledger. There is no custody
 * provider: funds arrive at and leave from accounts the business controls, and
 * a human performs the movement. What this module guarantees is that the
 * *books* only ever change in one direction from that, and only once.
 *
 * The ordering in each flow is the important part, chosen so any single step
 * failing leaves the system in a safe state rather than an over-credited one.
 * Every operator action that touches money carries an idempotency key, because
 * the realistic failure here is a double-click, not a network partition.
 */

/** New withdrawal addresses cannot be used for this long after being added. */
const ADDRESS_COOLING_OFF_MS = 24 * 60 * 60 * 1000

/* ------------------------------------------------------------------ */
/* Deposit addresses                                                   */
/* ------------------------------------------------------------------ */

/**
 * Returns the deposit address a user should be shown.
 *
 * Two sources, in strict order:
 *
 * Exactly one source: an address an operator recorded in the receiving-address
 * pool and assigned to this user. Nothing is generated, derived or defaulted.
 *
 * If no assignment exists it throws. It never returns a placeholder or another
 * user's address: whatever this returns, someone sends real money to, and a
 * transfer to the wrong destination cannot be undone by anyone.
 */
export async function getOrCreateDepositAddress(
  userId: string,
  assetId: string,
  network?: string,
): Promise<{ address: string; network: string; networkLabel: string; addressTag: string | null }> {
  const [asset] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1)
  if (!asset) throw new Error(`Unknown asset: ${assetId}`)

  const assigned = await getUserDepositAddress(userId, assetId, network)
  if (!assigned) throw new DepositAddressNotAssignedError(assetId)

  return {
    address: assigned.address,
    network: assigned.network,
    networkLabel: assigned.networkLabel,
    addressTag: assigned.addressTag,
  }
}

/* ------------------------------------------------------------------ */
/* Deposits                                                            */
/* ------------------------------------------------------------------ */

export class DepositError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'unknown_user'
      | 'unknown_asset'
      | 'no_address'
      | 'duplicate_tx'
      | 'not_found'
      | 'already_credited'
      | 'not_confirmed'
      | 'already_rejected',
  ) {
    super(message)
    this.name = 'DepositError'
  }
}

/**
 * Records a deposit an operator has seen arrive. Does NOT credit it.
 *
 * Recording and crediting are separate on purpose, and the separation is the
 * whole safety property of this flow. A transaction with one confirmation can
 * still be reorganised away; an operator reading an exchange screen can
 * misread an amount or pick the wrong customer. Recording captures the claim,
 * crediting acts on it, and the two are different actions by a person who can
 * check the first before taking the second.
 *
 * The deposit is bound to the address the user was actually assigned. If they
 * were never assigned one for this asset, there is nothing this deposit could
 * legitimately have arrived at, so it is refused.
 */
export async function recordDepositArrival(
  input: {
    userId: string
    assetId: string
    amount: string
    txHash: string
    confirmations: number
    network?: string
    notes?: string
  },
  actor: { id: string; context?: RequestContext },
) {
  const [asset] = await db.select().from(assets).where(eq(assets.id, input.assetId)).limit(1)
  if (!asset) throw new DepositError(`Unknown asset "${input.assetId}".`, 'unknown_asset')

  const assigned = await getUserDepositAddress(input.userId, input.assetId, input.network)
  if (!assigned) {
    throw new DepositError(
      `That user has no ${asset.symbol} deposit address assigned, so this deposit cannot be ` +
        'attributed to one. Assign an address first, then record the deposit.',
      'no_address',
    )
  }

  const required = defaultConfirmationsFor(input.assetId, assigned.network)

  const [row] = await db
    .insert(deposits)
    .values({
      userId: input.userId,
      assetId: input.assetId,
      amount: input.amount,
      network: assigned.network,
      address: assigned.address,
      txHash: input.txHash,
      confirmations: input.confirmations,
      requiredConfirmations: required,
      status: input.confirmations >= required ? 'confirming' : 'detected',
      provider: assigned.custodian,
      providerReference: input.notes?.slice(0, 128),
    })
    // The unique (txHash, assetId) index is what makes a double-click, a
    // retried request or the same transfer entered twice a no-op rather than a
    // second credit. Only the confirmation count moves.
    .onConflictDoUpdate({
      target: [deposits.txHash, deposits.assetId],
      set: { confirmations: input.confirmations },
    })
    .returning()

  if (row.userId !== input.userId) {
    // The conflict matched a row belonging to someone else: this transaction
    // hash is already recorded against another account. Never silently
    // reassign it — one on-chain transfer credits exactly one person.
    throw new DepositError(
      'That transaction hash is already recorded against a different account.',
      'duplicate_tx',
    )
  }

  await recordAudit({
    actorId: actor.id,
    actorRole: 'admin',
    action: AuditAction.DepositRecorded,
    targetType: 'deposit',
    targetId: row.id,
    metadata: {
      userId: input.userId,
      assetId: input.assetId,
      amount: input.amount,
      txHash: input.txHash,
      network: assigned.network,
      address: assigned.address,
      confirmations: input.confirmations,
      requiredConfirmations: required,
    },
    context: actor.context,
  })

  return row
}

/**
 * Credits a deposit that has reached its confirmation threshold.
 *
 * Two independent guards make this safe to call repeatedly, which matters
 * because the caller is a button a tired person clicks twice:
 *
 * 1. The `status <> 'credited'` predicate on the final UPDATE — only the first
 *    call transitions the row.
 * 2. The ledger's idempotency key, `deposit:<id>` — even if the first guard
 *    were bypassed, the second posting is rejected by the ledger itself.
 *
 * The confirmation check is not advisory. A deposit below its threshold cannot
 * be credited through this path at all; the operator has to wait, which is the
 * entire point of having a threshold.
 */
export async function creditConfirmedDeposit(
  depositId: string,
  actor?: { id: string; context?: RequestContext },
): Promise<boolean> {
  const [deposit] = await db
    .select()
    .from(deposits)
    .where(eq(deposits.id, depositId))
    .limit(1)

  if (!deposit) throw new DepositError('No deposit with that id.', 'not_found')
  if (deposit.status === 'credited') {
    throw new DepositError('That deposit has already been credited.', 'already_credited')
  }
  if (deposit.status === 'rejected') {
    throw new DepositError(
      'That deposit was rejected. Record a new one rather than reviving it.',
      'already_rejected',
    )
  }
  if (deposit.confirmations < deposit.requiredConfirmations) {
    throw new DepositError(
      `Not enough confirmations: ${deposit.confirmations} of ${deposit.requiredConfirmations} ` +
        'required. Crediting now risks a reorganisation reversing the transfer after the ' +
        'balance has been spent.',
      'not_confirmed',
    )
  }

  const userAccount = await ensureAccount(deposit.assetId, 'user_available', deposit.userId)
  const externalAccount = await ensureAccount(deposit.assetId, 'external', null)

  // Debit the outside world, credit the user. Sums to zero.
  const transactionId = await postTransaction({
    type: 'deposit',
    idempotencyKey: `deposit:${deposit.id}`,
    description: `Deposit ${deposit.amount} ${deposit.assetId}`,
    metadata: { txHash: deposit.txHash, network: deposit.network },
    postings: [
      { accountId: externalAccount, assetId: deposit.assetId, amount: negate(deposit.amount) },
      { accountId: userAccount, assetId: deposit.assetId, amount: deposit.amount },
    ],
  })

  const updated = await db
    .update(deposits)
    .set({ status: 'credited', creditedAt: new Date(), ledgerTransactionId: transactionId })
    .where(and(eq(deposits.id, depositId), sql`${deposits.status} <> 'credited'`))
    .returning({ id: deposits.id })

  // Only on the call that actually transitioned the row, so a repeated credit
  // attempt does not email the customer twice about one deposit.
  if (updated.length > 0) {
    const [owner] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, deposit.userId))
      .limit(1)

    if (owner) {
      await sendTransactionNotice({
        userId: deposit.userId,
        to: owner.email,
        kind: 'deposit',
        amount: deposit.amount,
        asset: deposit.assetId.toUpperCase(),
        network: networkLabel(deposit.network),
        txHash: deposit.txHash,
      })
    }
  }

  if (actor) {
    await recordAudit({
      actorId: actor.id,
      actorRole: 'admin',
      action: AuditAction.DepositCredited,
      targetType: 'deposit',
      targetId: depositId,
      metadata: {
        userId: deposit.userId,
        assetId: deposit.assetId,
        amount: deposit.amount,
        txHash: deposit.txHash,
        ledgerTransactionId: transactionId,
      },
      context: actor.context,
    })
  }

  return updated.length > 0
}

/**
 * Rejects a recorded deposit without crediting it.
 *
 * For the cases that do happen: an amount entered wrong, a transfer that never
 * confirmed, a transaction recorded against the wrong customer. Nothing is
 * deleted — the row stays with its reason, because "we have no record of it"
 * is the worst possible answer to a customer whose money is missing.
 *
 * A credited deposit cannot be rejected. Reversing a credit is a ledger
 * adjustment, posted as its own opposing transaction, so both the original and
 * the correction stay visible.
 */
export async function rejectDeposit(
  depositId: string,
  reason: string,
  actor: { id: string; context?: RequestContext },
): Promise<boolean> {
  const [deposit] = await db.select().from(deposits).where(eq(deposits.id, depositId)).limit(1)

  if (!deposit) throw new DepositError('No deposit with that id.', 'not_found')
  if (deposit.status === 'credited') {
    throw new DepositError(
      'That deposit is already credited. Post a ledger adjustment to reverse it — a credit ' +
        'that has been spent against cannot be withdrawn by changing this row.',
      'already_credited',
    )
  }
  if (deposit.status === 'rejected') return false

  await db.update(deposits).set({ status: 'rejected' }).where(eq(deposits.id, depositId))

  await recordAudit({
    actorId: actor.id,
    actorRole: 'admin',
    action: AuditAction.DepositRejected,
    targetType: 'deposit',
    targetId: depositId,
    metadata: {
      userId: deposit.userId,
      assetId: deposit.assetId,
      amount: deposit.amount,
      txHash: deposit.txHash,
      reason,
    },
    context: actor.context,
  })

  return true
}

/** Updates the confirmation count an operator has observed for a deposit. */
export async function updateDepositConfirmations(
  depositId: string,
  confirmations: number,
): Promise<{ confirmations: number; required: number; creditable: boolean }> {
  const [row] = await db
    .update(deposits)
    .set({ confirmations })
    .where(and(eq(deposits.id, depositId), sql`${deposits.status} in ('detected', 'confirming')`))
    .returning()

  if (!row) {
    throw new DepositError(
      'That deposit is not awaiting confirmation any more.',
      'not_found',
    )
  }

  if (row.confirmations >= row.requiredConfirmations && row.status === 'detected') {
    await db.update(deposits).set({ status: 'confirming' }).where(eq(deposits.id, depositId))
  }

  return {
    confirmations: row.confirmations,
    required: row.requiredConfirmations,
    creditable: row.confirmations >= row.requiredConfirmations,
  }
}

/** Deposits an operator still has to act on, newest first. */
export async function listDepositsForReview(filter?: {
  status?: 'detected' | 'confirming' | 'credited' | 'rejected' | 'failed'
  userId?: string
  limit?: number
}) {
  const conditions = [
    filter?.status ? eq(deposits.status, filter.status) : undefined,
    filter?.userId ? eq(deposits.userId, filter.userId) : undefined,
  ].filter(Boolean)

  const rows = await db
    .select({
      deposit: deposits,
      assetSymbol: assets.symbol,
      userEmail: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(deposits)
    .innerJoin(assets, eq(assets.id, deposits.assetId))
    .innerJoin(users, eq(users.id, deposits.userId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(deposits.detectedAt))
    .limit(filter?.limit ?? 100)

  return rows.map(({ deposit, assetSymbol, userEmail, firstName, lastName }) => ({
    id: deposit.id,
    userId: deposit.userId,
    userName: `${firstName} ${lastName}`,
    userEmail,
    assetId: deposit.assetId,
    assetSymbol,
    amount: deposit.amount,
    network: deposit.network,
    networkLabel: networkLabel(deposit.network),
    address: deposit.address,
    txHash: deposit.txHash,
    confirmations: deposit.confirmations,
    requiredConfirmations: deposit.requiredConfirmations,
    status: deposit.status,
    creditable:
      deposit.status !== 'credited' &&
      deposit.status !== 'rejected' &&
      deposit.confirmations >= deposit.requiredConfirmations,
    detectedAt: deposit.detectedAt.toISOString(),
    creditedAt: deposit.creditedAt?.toISOString() ?? null,
  }))
}

/* ------------------------------------------------------------------ */
/* Withdrawal addresses                                                */
/* ------------------------------------------------------------------ */

/**
 * Adds an address to a user's withdrawal allow-list.
 *
 * `network` is an id from `lib/deposit-networks.ts`, not free text, and the
 * address is checksum-validated against it before it is stored. A
 * wrong-network address that still looks correct — an EVM address pasted for a
 * Tron withdrawal — is the single most common way funds are lost forever, and
 * it is caught here because the network is chosen explicitly rather than
 * inferred from the asset.
 */
export async function addWithdrawalAddress(input: {
  userId: string
  userEmail: string
  assetId: string
  network: string
  address: string
  addressTag?: string
  label?: string
}) {
  const [asset] = await db.select().from(assets).where(eq(assets.id, input.assetId)).limit(1)
  if (!asset) throw new Error(`Unknown asset: ${input.assetId}`)

  const network = getNetwork(input.network)
  if (!network) throw new AddressValidationError(`Unknown network "${input.network}".`)

  if (!network.assetIds.includes(input.assetId)) {
    throw new AddressValidationError(
      `${asset.symbol} does not exist on ${network.label}. Sending it there would lose the funds.`,
    )
  }

  assertValidAddress(network.id, input.address)

  const tagCheck = checkAddressTag(network.id, input.addressTag)
  if (!tagCheck.valid) {
    throw new AddressValidationError(tagCheck.reason ?? 'That tag is not valid for this network.')
  }

  const [row] = await db
    .insert(withdrawalAddresses)
    .values({
      userId: input.userId,
      assetId: input.assetId,
      network: network.id,
      address: input.address,
      addressTag: input.addressTag,
      label: input.label,
      status: 'active',
      // Usable only after the cooling-off window.
      activeFrom: new Date(Date.now() + ADDRESS_COOLING_OFF_MS),
    })
    .onConflictDoNothing()
    .returning()

  // The owner is told immediately — this is how a session takeover is caught
  // while the attacker is still waiting out the cooling-off period.
  await sendSecurityAlert(
    input.userEmail,
    `A new withdrawal address was added for ${input.assetId.toUpperCase()}. ` +
      'It cannot be used for 24 hours.',
  )

  return row
}

/* ------------------------------------------------------------------ */
/* Withdrawals                                                         */
/* ------------------------------------------------------------------ */

export class WithdrawalError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'insufficient_funds'
      | 'address_not_allowed'
      | 'address_cooling_off'
      | 'duplicate'
      | 'not_found'
      | 'wrong_status'
      | 'self_approval',
  ) {
    super(message)
    this.name = 'WithdrawalError'
  }
}

/**
 * Requests a withdrawal and locks the funds.
 *
 * Locking happens now, at request time, before any approval. If funds stayed in
 * `available` until approval, several pending requests could each pass their
 * own balance check and the platform would approve payouts exceeding what it
 * holds.
 *
 * Nothing is sent to the custodian here — that happens only after approval.
 */
export async function requestWithdrawal(input: {
  userId: string
  assetId: string
  amount: string
  addressId: string
  idempotencyKey: string
}) {
  const [allowed] = await db
    .select()
    .from(withdrawalAddresses)
    .where(
      and(
        eq(withdrawalAddresses.id, input.addressId),
        eq(withdrawalAddresses.userId, input.userId),
        eq(withdrawalAddresses.status, 'active'),
        isNull(withdrawalAddresses.revokedAt),
      ),
    )
    .limit(1)

  if (!allowed) {
    throw new WithdrawalError(
      'That withdrawal address is not on your allow-list.',
      'address_not_allowed',
    )
  }

  if (allowed.activeFrom > new Date()) {
    throw new WithdrawalError(
      `That address becomes usable at ${allowed.activeFrom.toISOString()}.`,
      'address_cooling_off',
    )
  }

  const balances = await getUserBalances(input.userId)
  const balance = balances.find((entry) => entry.assetId === input.assetId)

  if (!balance || !hasSufficientFunds(balance.available, input.amount)) {
    throw new WithdrawalError('Insufficient available balance.', 'insufficient_funds')
  }

  const availableAccount = await ensureAccount(input.assetId, 'user_available', input.userId)
  const lockedAccount = await ensureAccount(input.assetId, 'user_locked', input.userId)

  return db.transaction(async () => {
    const lockTransactionId = await postTransaction({
      type: 'withdrawal_lock',
      idempotencyKey: `withdrawal-lock:${input.idempotencyKey}`,
      description: `Lock ${input.amount} ${input.assetId} for withdrawal`,
      postings: [
        { accountId: availableAccount, assetId: input.assetId, amount: negate(input.amount) },
        { accountId: lockedAccount, assetId: input.assetId, amount: input.amount },
      ],
    })

    const [row] = await db
      .insert(withdrawals)
      .values({
        userId: input.userId,
        assetId: input.assetId,
        amount: input.amount,
        network: allowed.network,
        destinationAddress: allowed.address,
        destinationTag: allowed.addressTag,
        status: 'pending_approval',
        idempotencyKey: input.idempotencyKey,
        lockTransactionId,
      })
      .returning()

    return row
  })
}

/**
 * Approves a withdrawal for payment. Moves no funds.
 *
 * With no custodian to submit to, approval means one thing: an operator is now
 * cleared to send the payment by hand from the business's own account. The
 * status stops at `approved` and the funds stay locked. `settleWithdrawal`
 * is what records that the payment actually went out.
 *
 * Keeping approval and payment separate is not ceremony. The approver checks
 * the request; whoever sends the money reads the destination off an approved
 * record rather than off a customer's message. Collapsing the two would mean
 * approving is paying, with no step in between where a wrong address is caught.
 *
 * `approverId` must differ from the requesting user — an operator cannot
 * release funds to themselves unchecked. For larger amounts this should be
 * extended to require two distinct approvers.
 */
export async function approveWithdrawal(
  withdrawalId: string,
  approverId: string,
  context?: RequestContext,
) {
  const [withdrawal] = await db
    .select()
    .from(withdrawals)
    .where(eq(withdrawals.id, withdrawalId))
    .limit(1)

  if (!withdrawal) throw new WithdrawalError('Withdrawal not found.', 'not_found')
  if (withdrawal.status !== 'pending_approval') {
    throw new WithdrawalError(
      `That withdrawal is ${withdrawal.status}, not awaiting approval.`,
      'wrong_status',
    )
  }
  if (withdrawal.userId === approverId) {
    throw new WithdrawalError('You cannot approve your own withdrawal.', 'self_approval')
  }

  const [row] = await db
    .update(withdrawals)
    .set({ status: 'approved', approvedBy: approverId, approvedAt: new Date() })
    // Re-checking the status here closes the gap between the read above and
    // this write: two operators clicking approve at once produce one approval.
    .where(and(eq(withdrawals.id, withdrawalId), eq(withdrawals.status, 'pending_approval')))
    .returning()

  if (!row) {
    throw new WithdrawalError('That withdrawal was already actioned.', 'wrong_status')
  }

  await recordAudit({
    actorId: approverId,
    actorRole: 'admin',
    action: AuditAction.WithdrawalApproved,
    targetType: 'withdrawal',
    targetId: withdrawalId,
    metadata: {
      userId: withdrawal.userId,
      amount: withdrawal.amount,
      assetId: withdrawal.assetId,
      network: withdrawal.network,
      destinationAddress: withdrawal.destinationAddress,
      destinationTag: withdrawal.destinationTag,
    },
    context,
  })

  return row
}

/** Withdrawals an operator has to act on, newest first. */
export async function listWithdrawalsForReview(filter?: {
  status?: 'pending_approval' | 'approved' | 'completed' | 'rejected'
  limit?: number
}) {
  const rows = await db
    .select({
      withdrawal: withdrawals,
      assetSymbol: assets.symbol,
      userEmail: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(withdrawals)
    .innerJoin(assets, eq(assets.id, withdrawals.assetId))
    .innerJoin(users, eq(users.id, withdrawals.userId))
    .where(filter?.status ? eq(withdrawals.status, filter.status) : undefined)
    .orderBy(desc(withdrawals.requestedAt))
    .limit(filter?.limit ?? 100)

  return rows.map(({ withdrawal, assetSymbol, userEmail, firstName, lastName }) => ({
    id: withdrawal.id,
    userId: withdrawal.userId,
    userName: `${firstName} ${lastName}`,
    userEmail,
    assetId: withdrawal.assetId,
    assetSymbol,
    amount: withdrawal.amount,
    fee: withdrawal.fee,
    network: withdrawal.network,
    networkLabel: networkLabel(withdrawal.network),
    destinationAddress: withdrawal.destinationAddress,
    destinationTag: withdrawal.destinationTag,
    status: withdrawal.status,
    txHash: withdrawal.txHash,
    rejectionReason: withdrawal.rejectionReason,
    requestedAt: withdrawal.requestedAt.toISOString(),
    approvedBy: withdrawal.approvedBy,
    approvedAt: withdrawal.approvedAt?.toISOString() ?? null,
    completedAt: withdrawal.completedAt?.toISOString() ?? null,
  }))
}

/**
 * Settles a paid withdrawal: locked funds leave the platform's books.
 *
 * Called once an operator has actually sent the payment and has the
 * transaction hash in hand. The hash is required, not optional — it is the
 * only evidence that the payment this row claims to represent happened, and
 * the customer's only way to verify it independently.
 *
 * Settling before sending would show a completed withdrawal for money still
 * sitting in the business's account, so the order is: send, then settle.
 */
export async function settleWithdrawal(
  withdrawalId: string,
  txHash: string,
  actor?: { id: string; context?: RequestContext },
) {
  const [withdrawal] = await db
    .select()
    .from(withdrawals)
    .where(eq(withdrawals.id, withdrawalId))
    .limit(1)

  if (!withdrawal) throw new WithdrawalError('Withdrawal not found.', 'not_found')
  if (withdrawal.status === 'completed') return false
  if (withdrawal.status !== 'approved' && withdrawal.status !== 'broadcasting') {
    throw new WithdrawalError(
      `That withdrawal is ${withdrawal.status}. Only an approved withdrawal can be settled — ` +
        'approve it first, so the destination is reviewed before money moves.',
      'wrong_status',
    )
  }

  const lockedAccount = await ensureAccount(
    withdrawal.assetId,
    'user_locked',
    withdrawal.userId,
  )
  const externalAccount = await ensureAccount(withdrawal.assetId, 'external', null)

  const settlementTransactionId = await postTransaction({
    type: 'withdrawal',
    idempotencyKey: `withdrawal-settle:${withdrawal.idempotencyKey}`,
    description: `Withdraw ${withdrawal.amount} ${withdrawal.assetId}`,
    metadata: { txHash },
    postings: [
      {
        accountId: lockedAccount,
        assetId: withdrawal.assetId,
        amount: negate(withdrawal.amount),
      },
      { accountId: externalAccount, assetId: withdrawal.assetId, amount: withdrawal.amount },
    ],
  })

  await db
    .update(withdrawals)
    .set({ status: 'completed', completedAt: new Date(), txHash, settlementTransactionId })
    .where(eq(withdrawals.id, withdrawalId))

  const [owner] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, withdrawal.userId))
    .limit(1)

  if (owner) {
    await sendTransactionNotice({
      userId: withdrawal.userId,
      to: owner.email,
      kind: 'withdrawal',
      amount: withdrawal.amount,
      asset: withdrawal.assetId.toUpperCase(),
      network: networkLabel(withdrawal.network),
      txHash,
    })
  }

  if (actor) {
    await recordAudit({
      actorId: actor.id,
      actorRole: 'admin',
      action: AuditAction.WithdrawalSettled,
      targetType: 'withdrawal',
      targetId: withdrawalId,
      metadata: {
        userId: withdrawal.userId,
        assetId: withdrawal.assetId,
        amount: withdrawal.amount,
        destinationAddress: withdrawal.destinationAddress,
        txHash,
        settlementTransactionId,
      },
      context: actor.context,
    })
  }

  return true
}

/**
 * Rejects a withdrawal and returns the locked funds.
 *
 * The unlock must post before the status flips, so a failure between the two
 * leaves funds locked (recoverable by retry) rather than released twice.
 */
export async function rejectWithdrawal(
  withdrawalId: string,
  reason: string,
  actorId?: string,
  context?: RequestContext,
) {
  const [withdrawal] = await db
    .select()
    .from(withdrawals)
    .where(eq(withdrawals.id, withdrawalId))
    .limit(1)

  if (!withdrawal) throw new WithdrawalError('Withdrawal not found.', 'not_found')
  if (withdrawal.status === 'completed') {
    throw new WithdrawalError(
      'A completed withdrawal cannot be rejected — the money has already left. Record a ' +
        'deposit if it comes back.',
      'wrong_status',
    )
  }
  if (withdrawal.status === 'rejected') return false

  const availableAccount = await ensureAccount(
    withdrawal.assetId,
    'user_available',
    withdrawal.userId,
  )
  const lockedAccount = await ensureAccount(
    withdrawal.assetId,
    'user_locked',
    withdrawal.userId,
  )

  await postTransaction({
    type: 'withdrawal_unlock',
    idempotencyKey: `withdrawal-unlock:${withdrawal.idempotencyKey}`,
    description: `Return ${withdrawal.amount} ${withdrawal.assetId} after rejection`,
    metadata: { reason },
    createdBy: actorId,
    postings: [
      {
        accountId: lockedAccount,
        assetId: withdrawal.assetId,
        amount: negate(withdrawal.amount),
      },
      { accountId: availableAccount, assetId: withdrawal.assetId, amount: withdrawal.amount },
    ],
  })

  await db
    .update(withdrawals)
    .set({ status: 'rejected', rejectionReason: reason })
    .where(eq(withdrawals.id, withdrawalId))

  await recordAudit({
    actorId: actorId ?? null,
    actorRole: 'admin',
    action: AuditAction.WithdrawalRejected,
    targetType: 'withdrawal',
    targetId: withdrawalId,
    metadata: {
      userId: withdrawal.userId,
      assetId: withdrawal.assetId,
      amount: withdrawal.amount,
      reason,
    },
    context,
  })

  return true
}

/** Addresses whose cooling-off period has elapsed — for a status display. */
export async function listUsableWithdrawalAddresses(userId: string) {
  return db
    .select()
    .from(withdrawalAddresses)
    .where(
      and(
        eq(withdrawalAddresses.userId, userId),
        eq(withdrawalAddresses.status, 'active'),
        isNull(withdrawalAddresses.revokedAt),
        lte(withdrawalAddresses.activeFrom, new Date()),
      ),
    )
}

/** Addresses still inside the cooling-off window. */
export async function listPendingWithdrawalAddresses(userId: string) {
  return db
    .select()
    .from(withdrawalAddresses)
    .where(
      and(
        eq(withdrawalAddresses.userId, userId),
        isNull(withdrawalAddresses.revokedAt),
        gt(withdrawalAddresses.activeFrom, new Date()),
      ),
    )
}
