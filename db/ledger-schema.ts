/**
 * Double-entry ledger, custody and transfer schema.
 *
 * The central rule: **balances are never stored as an editable number.** A
 * balance is the sum of immutable ledger entries. There is no UPDATE that can
 * set someone's balance — the only way to change it is to post a transaction,
 * and every transaction must balance to zero per asset.
 *
 * That constraint is what makes the system auditable. A stored, mutable balance
 * column can drift, be corrupted by a partial failure, or be quietly edited; a
 * sum over an append-only journal cannot. It is also what lets you answer
 * "where did this money come from" for any figure on any screen.
 *
 * Amounts use numeric(38,18): 18 decimals covers ETH's wei precision, and 38
 * total digits leaves ample headroom. Never floats — a rounding error in a
 * balance is a real loss to a real person.
 */

import { relations, sql } from 'drizzle-orm'
import {
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { assets, investmentPlans, users } from './schema'

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

/**
 * Account types.
 *
 * `external` represents the world outside the platform. Every deposit credits a
 * user and debits `external`; every withdrawal does the reverse. Modelling the
 * outside world as an account is what keeps each transaction summing to zero.
 */
export const ledgerAccountTypeEnum = pgEnum('ledger_account_type', [
  'user_available',
  'user_locked',
  'platform_fee',
  'platform_liability',
  /**
   * The account that funds promised investment returns.
   *
   * Exists so a return cannot be paid out of thin air. Because every ledger
   * transaction must sum to zero, paying a return debits this account — and if
   * the business has not funded it, the balance goes negative and the maturity
   * is refused. That is the difference between owing a return and being able
   * to pay one, and it is the single most important control in the investment
   * flow: without it, returns would be funded silently from other customers'
   * deposits, which is the mechanism of a Ponzi scheme.
   */
  'platform_treasury',
  'external',
])

export const ledgerTxTypeEnum = pgEnum('ledger_tx_type', [
  'deposit',
  'withdrawal',
  'withdrawal_lock',
  'withdrawal_unlock',
  'fee',
  'transfer',
  'adjustment',
  /** Principal moved from available to locked when an investment starts. */
  'investment_lock',
  /** Principal returned to available at maturity or on cancellation. */
  'investment_release',
  /** The promised return, debited from the platform treasury. */
  'investment_return',
  /** An operator putting real money into the treasury so returns can be paid. */
  'treasury_funding',
])

export const depositStatusEnum = pgEnum('deposit_status', [
  'detected',
  'confirming',
  'credited',
  'failed',
  'rejected',
])

export const withdrawalStatusEnum = pgEnum('withdrawal_status', [
  'requested',
  'pending_approval',
  'approved',
  'broadcasting',
  'completed',
  'rejected',
  'failed',
])

export const addressStatusEnum = pgEnum('address_status', ['pending', 'active', 'revoked'])

/* ------------------------------------------------------------------ */
/* Ledger                                                              */
/* ------------------------------------------------------------------ */

export const ledgerAccounts = pgTable(
  'ledger_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Null for platform and external accounts.
    userId: uuid('user_id').references(() => users.id, { onDelete: 'restrict' }),
    assetId: varchar('asset_id', { length: 32 })
      .notNull()
      .references(() => assets.id, { onDelete: 'restrict' }),
    type: ledgerAccountTypeEnum('type').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // One account per (user, asset, type). Prevents a second "available"
    // account appearing and silently splitting someone's balance in two.
    uniqueAccount: uniqueIndex('ledger_accounts_unique_idx').on(
      table.userId,
      table.assetId,
      table.type,
    ),
    userIdx: index('ledger_accounts_user_idx').on(table.userId),
  }),
)

/**
 * A ledger transaction groups the entries that must post together.
 *
 * `idempotencyKey` is unique and required. Retried requests, duplicate webhooks
 * and at-least-once queues are normal; without this, a repeated custody webhook
 * credits the same deposit twice.
 */
export const ledgerTransactions = pgTable(
  'ledger_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: ledgerTxTypeEnum('type').notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 200 }).notNull(),
    description: text('description'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    /** Set for entries posted by an operator rather than by a system flow. */
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idempotencyIdx: uniqueIndex('ledger_tx_idempotency_idx').on(table.idempotencyKey),
    createdAtIdx: index('ledger_tx_created_at_idx').on(table.createdAt),
    typeIdx: index('ledger_tx_type_idx').on(table.type, table.createdAt),
  }),
)

/**
 * Individual postings. Immutable once written — there is no update path.
 *
 * A correction is a new, opposing transaction, so the original mistake and its
 * reversal both remain visible. Editing history away is how discrepancies get
 * hidden rather than found.
 */
export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => ledgerTransactions.id, { onDelete: 'restrict' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => ledgerAccounts.id, { onDelete: 'restrict' }),
    assetId: varchar('asset_id', { length: 32 })
      .notNull()
      .references(() => assets.id, { onDelete: 'restrict' }),
    /** Signed: positive credits the account, negative debits it. */
    amount: numeric('amount', { precision: 38, scale: 18 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Serves balance sums, which scan every entry for an account.
    accountIdx: index('ledger_entries_account_idx').on(table.accountId),
    transactionIdx: index('ledger_entries_transaction_idx').on(table.transactionId),
  }),
)

/* ------------------------------------------------------------------ */
/* Custody addresses                                                   */
/* ------------------------------------------------------------------ */

/**
 * The platform's own receiving addresses — the pool an admin assigns from.
 *
 * This is the centralised custody model: the business holds accounts at an
 * exchange or custodian (Bybit, in the deployment this was built for), an
 * operator records those receiving addresses here, and each one is then shown
 * to specific users. Funds land in the business's account, not in a wallet the
 * application controls.
 *
 * Two things follow from that, and both are enforced rather than documented:
 *
 * 1. An address is entered by a human, so it is checksum-validated on write
 *    (`lib/server/address-validation.ts`). A mistyped address here would send
 *    every assigned user's deposit somewhere unrecoverable.
 *
 * 2. An address is not automatically attributable. The chain does not record
 *    which of your users sent a transfer. `addressTag` is what restores that:
 *    on memo networks one address plus a per-user tag identifies the sender.
 *    Without a tag, matching deposits to users is manual reconciliation.
 */
export const platformDepositAddresses = pgTable(
  'platform_deposit_addresses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assetId: varchar('asset_id', { length: 32 })
      .notNull()
      .references(() => assets.id, { onDelete: 'restrict' }),
    /** An id from `lib/deposit-networks.ts`, not free text. */
    network: varchar('network', { length: 64 }).notNull(),
    address: varchar('address', { length: 128 }).notNull(),
    addressTag: varchar('address_tag', { length: 64 }),

    /** Operator-facing name, e.g. "Bybit main — USDT TRC-20". */
    label: varchar('label', { length: 96 }).notNull(),
    /** Where the address actually lives: 'bybit', 'binance', 'self-custody'. */
    custodian: varchar('custodian', { length: 32 }).notNull(),
    notes: text('notes'),

    /** 'active' may be assigned and displayed; 'revoked' is retired for good. */
    status: addressStatusEnum('status').notNull().default('active'),

    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedBy: uuid('revoked_by').references(() => users.id, { onDelete: 'set null' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => ({
    lookupIdx: index('platform_deposit_addresses_lookup_idx').on(
      table.assetId,
      table.network,
      table.status,
    ),
    /**
     * One row per destination, where a destination is address + network + tag.
     *
     * The tag belongs in the key: on memo networks the same exchange address
     * is used for every customer and only the tag distinguishes them, so
     * excluding it would make those rows collide. `coalesce` is needed because
     * Postgres treats NULLs as distinct, which would otherwise allow the same
     * untagged address to be entered twice.
     */
    destinationIdx: uniqueIndex('platform_deposit_addresses_destination_idx').on(
      table.address,
      table.network,
      sql`coalesce(${table.addressTag}, '')`,
    ),
  }),
)

/**
 * Which receiving address a given user is shown.
 *
 * A row here is the assignment itself, not an address the platform generated.
 * It points at a pool entry (`sourceAddressId`) when an operator assigned it,
 * and carries a copy of the destination so the user keeps seeing the address
 * they were actually given even if the pool row is later edited or retired.
 *
 * Nothing in the application may invent an address. Every row originates either
 * from a custody provider response or from a pool entry a human entered and the
 * validator accepted — funds sent to an address nobody holds keys for are
 * permanently, irrecoverably gone.
 */
export const depositAddresses = pgTable(
  'deposit_addresses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    assetId: varchar('asset_id', { length: 32 })
      .notNull()
      .references(() => assets.id, { onDelete: 'restrict' }),
    network: varchar('network', { length: 64 }).notNull(),
    address: varchar('address', { length: 128 }).notNull(),
    /** Memo/tag networks (XRP, XLM, some exchanges) need this to credit correctly. */
    addressTag: varchar('address_tag', { length: 64 }),

    /** Set when assigned from the pool; null when a custodian generated it. */
    sourceAddressId: uuid('source_address_id').references(() => platformDepositAddresses.id, {
      onDelete: 'restrict',
    }),
    /** The operator who made the assignment. Null for provider-generated rows. */
    assignedBy: uuid('assigned_by').references(() => users.id, { onDelete: 'set null' }),

    status: addressStatusEnum('status').notNull().default('active'),

    provider: varchar('provider', { length: 32 }).notNull(),
    providerReference: varchar('provider_reference', { length: 128 }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => ({
    userAssetIdx: index('deposit_addresses_user_asset_idx').on(table.userId, table.assetId),
    sourceIdx: index('deposit_addresses_source_idx').on(table.sourceAddressId),
    /**
     * At most one *active* address per user, asset and network.
     *
     * Partial rather than absolute so reassignment keeps its history: the old
     * row stays, revoked, and remains the explanation for any funds that arrive
     * at it afterwards. Two active rows would mean two screens showing two
     * different addresses for the same deposit.
     */
    activePerUserIdx: uniqueIndex('deposit_addresses_active_idx')
      .on(table.userId, table.assetId, table.network)
      .where(sql`${table.status} = 'active'`),
  }),
)

/**
 * Withdrawal allow-list.
 *
 * `activeFrom` implements a cooling-off period: a newly added address cannot be
 * withdrawn to immediately. An attacker who takes over a session can then add
 * an address but cannot drain funds to it before the owner is notified and can
 * intervene.
 */
export const withdrawalAddresses = pgTable(
  'withdrawal_addresses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    assetId: varchar('asset_id', { length: 32 })
      .notNull()
      .references(() => assets.id, { onDelete: 'restrict' }),
    network: varchar('network', { length: 64 }).notNull(),
    address: varchar('address', { length: 128 }).notNull(),
    addressTag: varchar('address_tag', { length: 64 }),
    label: varchar('label', { length: 64 }),

    status: addressStatusEnum('status').notNull().default('pending'),
    /** Withdrawals to this address are refused before this timestamp. */
    activeFrom: timestamp('active_from', { withTimezone: true }).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => ({
    userIdx: index('withdrawal_addresses_user_idx').on(table.userId),
    uniquePerUser: uniqueIndex('withdrawal_addresses_unique_idx').on(
      table.userId,
      table.assetId,
      table.address,
    ),
  }),
)

/* ------------------------------------------------------------------ */
/* Deposits                                                            */
/* ------------------------------------------------------------------ */

/**
 * Incoming transfers.
 *
 * A deposit is recorded when detected but **credited to the ledger only once
 * `confirmations >= requiredConfirmations`**. Crediting on detection is how
 * platforms lose money to chain reorganisations: the user withdraws against a
 * balance backed by a transaction that later disappears.
 */
export const deposits = pgTable(
  'deposits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    assetId: varchar('asset_id', { length: 32 })
      .notNull()
      .references(() => assets.id, { onDelete: 'restrict' }),

    amount: numeric('amount', { precision: 38, scale: 18 }).notNull(),
    network: varchar('network', { length: 64 }).notNull(),
    address: varchar('address', { length: 128 }).notNull(),

    txHash: varchar('tx_hash', { length: 128 }),
    confirmations: integer('confirmations').notNull().default(0),
    requiredConfirmations: integer('required_confirmations').notNull(),

    status: depositStatusEnum('status').notNull().default('detected'),
    /** Set once credited; links the balance change to its cause. */
    ledgerTransactionId: uuid('ledger_transaction_id').references(() => ledgerTransactions.id),

    provider: varchar('provider', { length: 32 }).notNull(),
    providerReference: varchar('provider_reference', { length: 128 }),

    detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
    creditedAt: timestamp('credited_at', { withTimezone: true }),
  },
  (table) => ({
    userIdx: index('deposits_user_idx').on(table.userId, table.detectedAt),
    statusIdx: index('deposits_status_idx').on(table.status),
    // The same on-chain transfer must never be recorded twice.
    txIdx: uniqueIndex('deposits_tx_idx').on(table.txHash, table.assetId),
  }),
)

/* ------------------------------------------------------------------ */
/* Withdrawals                                                         */
/* ------------------------------------------------------------------ */

/**
 * Outgoing transfers.
 *
 * Funds are moved from `user_available` to `user_locked` the moment a request
 * is made, before any approval. Otherwise the same balance can back several
 * concurrent withdrawal requests and the platform pays out more than it holds.
 *
 * `approvedBy` is recorded separately from the requester so an operator cannot
 * approve their own request — separation of duties is enforced in the service
 * layer and evidenced here.
 */
export const withdrawals = pgTable(
  'withdrawals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    assetId: varchar('asset_id', { length: 32 })
      .notNull()
      .references(() => assets.id, { onDelete: 'restrict' }),

    amount: numeric('amount', { precision: 38, scale: 18 }).notNull(),
    fee: numeric('fee', { precision: 38, scale: 18 }).notNull().default('0'),

    network: varchar('network', { length: 64 }).notNull(),
    destinationAddress: varchar('destination_address', { length: 128 }).notNull(),
    destinationTag: varchar('destination_tag', { length: 64 }),

    status: withdrawalStatusEnum('status').notNull().default('requested'),
    rejectionReason: text('rejection_reason'),

    /** Guards against a double-submit creating two identical payouts. */
    idempotencyKey: varchar('idempotency_key', { length: 200 }).notNull(),

    lockTransactionId: uuid('lock_transaction_id').references(() => ledgerTransactions.id),
    settlementTransactionId: uuid('settlement_transaction_id').references(
      () => ledgerTransactions.id,
    ),

    provider: varchar('provider', { length: 32 }),
    providerReference: varchar('provider_reference', { length: 128 }),
    txHash: varchar('tx_hash', { length: 128 }),

    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    userIdx: index('withdrawals_user_idx').on(table.userId, table.requestedAt),
    statusIdx: index('withdrawals_status_idx').on(table.status),
    idempotencyIdx: uniqueIndex('withdrawals_idempotency_idx').on(table.idempotencyKey),
  }),
)

/* ------------------------------------------------------------------ */
/* Investments                                                         */
/* ------------------------------------------------------------------ */

export const investmentStatusEnum = pgEnum('investment_status', [
  'active',
  'matured',
  'cancelled',
])

/**
 * A customer's subscription to an investment plan.
 *
 * **Every commercial term is copied here at subscription time, not referenced.**
 * An operator can edit a plan tomorrow; what this person agreed to today must
 * not move with it. Pointing at `investment_plans` for the rate would mean a
 * plan edit silently rewriting live contracts, which is both a legal problem
 * and an accounting one.
 *
 * The principal is *locked* in the ledger for the term, exactly as a pending
 * withdrawal is. Without that, the same balance could back an investment and a
 * withdrawal at once and the platform would owe more than it holds.
 */
export const investments = pgTable(
  'investments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** Restricted: a plan with live contracts against it cannot be deleted. */
    planId: varchar('plan_id', { length: 32 })
      .notNull()
      .references(() => investmentPlans.id, { onDelete: 'restrict' }),
    assetId: varchar('asset_id', { length: 32 })
      .notNull()
      .references(() => assets.id, { onDelete: 'restrict' }),

    /** In asset units. The return is paid in the same asset, so no FX at maturity. */
    principal: numeric('principal', { precision: 38, scale: 18 }).notNull(),

    /* --- terms frozen at subscription --------------------------------- */
    planName: varchar('plan_name', { length: 64 }).notNull(),
    fixedRatePercent: numeric('fixed_rate_percent', { precision: 6, scale: 3 }).notNull(),
    rateBasis: varchar('rate_basis', { length: 16 }).notNull(),
    durationDays: integer('duration_days').notNull(),
    /**
     * The exact payout owed, computed once and stored.
     *
     * Not recomputed at maturity. Recomputing would make the amount owed
     * depend on today's code, so a change to the rounding rule would quietly
     * alter what every existing customer is owed.
     */
    expectedReturn: numeric('expected_return', { precision: 38, scale: 18 }).notNull(),
    /** What the disclosure said when they signed, kept verbatim. */
    yieldSource: text('yield_source').notNull(),
    riskDisclosure: text('risk_disclosure').notNull(),

    /* --- valuation at entry, for reporting only ------------------------ */
    usdValueAtStart: numeric('usd_value_at_start', { precision: 38, scale: 2 }),
    priceAtStart: numeric('price_at_start', { precision: 38, scale: 12 }),

    status: investmentStatusEnum('status').notNull().default('active'),

    lockTransactionId: uuid('lock_transaction_id').references(() => ledgerTransactions.id),
    releaseTransactionId: uuid('release_transaction_id').references(() => ledgerTransactions.id),

    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    maturesAt: timestamp('matures_at', { withTimezone: true }).notNull(),
    maturedAt: timestamp('matured_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),

    /** Guards a double-submitted subscription. */
    idempotencyKey: varchar('idempotency_key', { length: 200 }).notNull(),
  },
  (table) => ({
    userIdx: index('investments_user_idx').on(table.userId, table.startedAt),
    /** Serves the maturity sweep: active contracts whose term has elapsed. */
    maturityIdx: index('investments_maturity_idx').on(table.status, table.maturesAt),
    idempotencyIdx: uniqueIndex('investments_idempotency_idx').on(table.idempotencyKey),
  }),
)

export type Investment = typeof investments.$inferSelect

/* ------------------------------------------------------------------ */
/* Relations                                                           */
/* ------------------------------------------------------------------ */

export const ledgerAccountsRelations = relations(ledgerAccounts, ({ one, many }) => ({
  user: one(users, { fields: [ledgerAccounts.userId], references: [users.id] }),
  entries: many(ledgerEntries),
}))

export const ledgerEntriesRelations = relations(ledgerEntries, ({ one }) => ({
  account: one(ledgerAccounts, {
    fields: [ledgerEntries.accountId],
    references: [ledgerAccounts.id],
  }),
  transaction: one(ledgerTransactions, {
    fields: [ledgerEntries.transactionId],
    references: [ledgerTransactions.id],
  }),
}))

export const ledgerTransactionsRelations = relations(ledgerTransactions, ({ many }) => ({
  entries: many(ledgerEntries),
}))

export const platformDepositAddressesRelations = relations(
  platformDepositAddresses,
  ({ many }) => ({
    assignments: many(depositAddresses),
  }),
)

export const depositAddressesRelations = relations(depositAddresses, ({ one }) => ({
  user: one(users, { fields: [depositAddresses.userId], references: [users.id] }),
  source: one(platformDepositAddresses, {
    fields: [depositAddresses.sourceAddressId],
    references: [platformDepositAddresses.id],
  }),
}))

export type LedgerAccount = typeof ledgerAccounts.$inferSelect
export type LedgerEntry = typeof ledgerEntries.$inferSelect
export type PlatformDepositAddress = typeof platformDepositAddresses.$inferSelect
export type DepositAddress = typeof depositAddresses.$inferSelect
export type Deposit = typeof deposits.$inferSelect
export type Withdrawal = typeof withdrawals.$inferSelect
export type WithdrawalAddress = typeof withdrawalAddresses.$inferSelect
