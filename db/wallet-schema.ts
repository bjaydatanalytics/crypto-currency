/**
 * Non-custodial wallet schema.
 *
 * The defining difference from `ledger-schema.ts`: nothing here records a
 * balance. A linked wallet is a *claim of ownership over an address* — the
 * balance lives on-chain and is read, never stored as truth.
 *
 * That is what makes the model non-custodial. There is no column anywhere in
 * this file that the platform could edit to change what a user holds, and no
 * key material is stored: proving ownership is done with a signature the user
 * produces, which we verify and discard.
 */

import { relations } from 'drizzle-orm'
import {
  index,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { users } from './schema'

/** Chains the reader supports. EVM only for now — Solana needs ed25519. */
export const walletChainEnum = pgEnum('wallet_chain', [
  'ethereum',
  'polygon',
  'arbitrum',
  'base',
  'optimism',
])

export const walletStatusEnum = pgEnum('wallet_status', ['active', 'revoked'])

/**
 * Wallets a user has proven control of.
 *
 * `verifiedAt` is only ever set by `POST /api/wallets` after a signature has
 * been checked against the address. A row without it means nothing was proven.
 */
export const linkedWallets = pgTable(
  'linked_wallets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    chain: walletChainEnum('chain').notNull(),
    /** Stored lower-cased; EVM addresses are case-insensitive but EIP-55 varies. */
    address: varchar('address', { length: 64 }).notNull(),
    label: varchar('label', { length: 64 }),

    status: walletStatusEnum('status').notNull().default('active'),

    /** Set only after a verified signature. Never set by an admin action. */
    verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => ({
    userIdx: index('linked_wallets_user_idx').on(table.userId),
    /**
     * One row per (user, chain, address).
     *
     * Not globally unique on address: two people can legitimately link the same
     * public address — a shared treasury, or one person with two accounts.
     * Linking an address grants no authority over it, so this is safe.
     */
    uniquePerUser: uniqueIndex('linked_wallets_unique_idx').on(
      table.userId,
      table.chain,
      table.address,
    ),
  }),
)

/**
 * Single-use challenges for proving address ownership.
 *
 * A nonce is issued to one user, expires quickly, and is consumed atomically on
 * use. Without all three, a signature captured from anywhere — another site,
 * an old session, a log — could be replayed to link an address the attacker
 * does not control.
 */
export const walletNonces = pgTable(
  'wallet_nonces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** The random value embedded in the signed message. */
    nonce: varchar('nonce', { length: 64 }).notNull(),
    /** Bound at issue time so a signature cannot be reused for another address. */
    address: varchar('address', { length: 64 }).notNull(),
    chain: walletChainEnum('chain').notNull(),

    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    nonceIdx: uniqueIndex('wallet_nonces_value_idx').on(table.nonce),
    userIdx: index('wallet_nonces_user_idx').on(table.userId, table.createdAt),
  }),
)

export const linkedWalletsRelations = relations(linkedWallets, ({ one }) => ({
  user: one(users, { fields: [linkedWallets.userId], references: [users.id] }),
}))

export type LinkedWallet = typeof linkedWallets.$inferSelect
export type WalletChain = (typeof walletChainEnum.enumValues)[number]
