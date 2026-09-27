/**
 * Database schema.
 *
 * Design rules that apply throughout:
 *
 * - Money and asset amounts are NEVER floats. They use `numeric` and are read
 *   as strings, then handled with a decimal type at the edges. A float rounding
 *   error in a balance is a real loss to a real person.
 * - Secrets (session tokens, verification tokens, recovery codes) are stored
 *   hashed, never in plaintext. A database leak must not hand over live
 *   sessions or the ability to reset an account.
 * - Everything security-relevant writes to `auditLog`, which is append-only by
 *   convention and should be append-only by grant in production.
 */

import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  check,
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

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const userRoleEnum = pgEnum('user_role', ['user', 'admin'])
export const userStatusEnum = pgEnum('user_status', ['active', 'suspended', 'closed'])
export const kycStatusEnum = pgEnum('kyc_status', [
  'unverified',
  'pending',
  'verified',
  'rejected',
])
export const tokenPurposeEnum = pgEnum('token_purpose', [
  'email_verification',
  'password_reset',
])

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /**
     * Always stored lower-cased — `emailSchema` normalises before any write.
     * That keeps the unique index a plain b-tree on the column, which can serve
     * both uniqueness and lookups, and can be an ON CONFLICT target.
     */
    email: varchar('email', { length: 320 }).notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),

    // Argon2id hash. Never a plaintext or reversible value.
    passwordHash: text('password_hash').notNull(),
    passwordChangedAt: timestamp('password_changed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    phone: varchar('phone', { length: 32 }),
    country: varchar('country', { length: 2 }),

    role: userRoleEnum('role').notNull().default('user'),
    status: userStatusEnum('status').notNull().default('active'),
    kycStatus: kycStatusEnum('kyc_status').notNull().default('unverified'),

    // TOTP secret, encrypted at rest by the application before storage.
    totpSecret: text('totp_secret'),
    totpEnabledAt: timestamp('totp_enabled_at', { withTimezone: true }),

    // Brute-force throttling, evaluated per account as well as per IP.
    failedLoginCount: integer('failed_login_count').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),

    acceptedTermsAt: timestamp('accepted_terms_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
    roleIdx: index('users_role_idx').on(table.role),
    createdAtIdx: index('users_created_at_idx').on(table.createdAt),
  }),
)

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

/**
 * Server-side sessions rather than stateless JWTs.
 *
 * A financial product needs immediate revocation: "sign out all other devices"
 * must take effect now, not when a token happens to expire. That requires the
 * server to hold the list.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // SHA-256 of the opaque token. The plaintext exists only in the cookie.
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),

    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),

    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex('sessions_token_hash_idx').on(table.tokenHash),
    userIdx: index('sessions_user_idx').on(table.userId),
    expiresIdx: index('sessions_expires_idx').on(table.expiresAt),
  }),
)

/* ------------------------------------------------------------------ */
/* One-time tokens                                                     */
/* ------------------------------------------------------------------ */

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: tokenPurposeEnum('purpose').notNull(),

    // Hashed, like sessions: a leaked table must not allow account takeover.
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),

    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex('verification_tokens_hash_idx').on(table.tokenHash),
    userPurposeIdx: index('verification_tokens_user_purpose_idx').on(
      table.userId,
      table.purpose,
    ),
  }),
)

/** Single-use 2FA recovery codes, stored hashed. */
export const recoveryCodes = pgTable(
  'recovery_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    codeHash: varchar('code_hash', { length: 64 }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('recovery_codes_user_idx').on(table.userId),
    codeHashIdx: uniqueIndex('recovery_codes_hash_idx').on(table.codeHash),
  }),
)

/* ------------------------------------------------------------------ */
/* Login history                                                       */
/* ------------------------------------------------------------------ */

export const loginEvents = pgTable(
  'login_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Nullable: failed attempts against an unknown address have no user.
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    emailAttempted: varchar('email_attempted', { length: 320 }),
    success: boolean('success').notNull(),
    failureReason: varchar('failure_reason', { length: 64 }),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('login_events_user_idx').on(table.userId, table.createdAt),
    ipIdx: index('login_events_ip_idx').on(table.ipAddress, table.createdAt),
  }),
)

/* ------------------------------------------------------------------ */
/* KYC                                                                 */
/* ------------------------------------------------------------------ */

/**
 * KYC records.
 *
 * Deliberately holds NO identity document images or numbers. Those belong with
 * the KYC provider, which is built to store them lawfully; mirroring them here
 * multiplies breach exposure for no benefit. This table keeps the provider's
 * reference, the decision, and why.
 */
export const kycRecords = pgTable(
  'kyc_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    provider: varchar('provider', { length: 64 }).notNull(),
    providerReference: varchar('provider_reference', { length: 128 }),

    status: kycStatusEnum('status').notNull().default('pending'),
    rejectionReason: text('rejection_reason'),

    // Risk screening outcomes recorded for the audit trail.
    sanctionsChecked: boolean('sanctions_checked').notNull().default(false),
    pepChecked: boolean('pep_checked').notNull().default(false),
    riskLevel: varchar('risk_level', { length: 16 }),

    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => ({
    userIdx: index('kyc_records_user_idx').on(table.userId),
    statusIdx: index('kyc_records_status_idx').on(table.status),
  }),
)

/**
 * Per-user preferences.
 *
 * A separate table rather than columns on `users` because these are chosen by
 * the person, while everything on `users` is either identity or something an
 * operator controls. Mixing them means a preferences form and an admin action
 * write to the same row.
 *
 * Note what is absent: **there is no flag for security alerts.** Notifications
 * about password changes, 2FA changes and new withdrawal addresses are how
 * someone discovers their account was taken over, and an attacker with a live
 * session would turn them off first. They are not configurable, so there is no
 * column here to set.
 *
 * Consent columns are opt-in (`false` by default) and carry the timestamp of
 * the decision. "When did they agree" is the question that actually gets asked
 * about consent, and a bare boolean cannot answer it.
 */
export const userPreferences = pgTable('user_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),

  /** Deposits credited, withdrawals paid. Default on: it is money movement. */
  transactionEmails: boolean('transaction_emails').notNull().default(true),

  /** Opt-in. Nothing may be sent for marketing purposes while this is false. */
  marketingEmails: boolean('marketing_emails').notNull().default(false),
  marketingConsentAt: timestamp('marketing_consent_at', { withTimezone: true }),

  /** Opt-in. Read before any analytics script is loaded. */
  analyticsConsent: boolean('analytics_consent').notNull().default(false),
  analyticsConsentAt: timestamp('analytics_consent_at', { withTimezone: true }),

  /**
   * Display preferences.
   *
   * Stored, but only one value of each currently works: converting to another
   * currency needs a foreign-exchange rate source, and another language needs
   * translations. The UI offers what is real and says why the rest is absent,
   * rather than presenting a choice that silently does nothing.
   */
  displayCurrency: varchar('display_currency', { length: 8 }).notNull().default('USD'),
  language: varchar('language', { length: 8 }).notNull().default('en'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type UserPreferences = typeof userPreferences.$inferSelect

/* ------------------------------------------------------------------ */
/* Support                                                             */
/* ------------------------------------------------------------------ */

export const ticketCategoryEnum = pgEnum('ticket_category', [
  'account',
  'verification',
  'deposit',
  'withdrawal',
  'investment',
  'other',
])

/**
 * Ticket state, expressed as *who is waiting on whom*.
 *
 * "Open" alone tells an operator nothing about whether the ball is in their
 * court. These four states let a queue answer "what needs me now" without
 * anybody manually maintaining a flag — posting a reply moves it.
 */
export const ticketStatusEnum = pgEnum('ticket_status', [
  'awaiting_support',
  'awaiting_customer',
  'resolved',
  'closed',
])

export const ticketPriorityEnum = pgEnum('ticket_priority', ['low', 'normal', 'high'])

export const supportTickets = pgTable(
  'support_tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * Restricted, not cascading.
     *
     * A support history is evidence in a dispute — about a missing deposit, a
     * refused withdrawal, an investment term. Deleting the customer must not
     * silently delete the record of what they were told.
     */
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    subject: varchar('subject', { length: 200 }).notNull(),
    category: ticketCategoryEnum('category').notNull().default('other'),
    status: ticketStatusEnum('status').notNull().default('awaiting_support'),
    priority: ticketPriorityEnum('priority').notNull().default('normal'),

    /** Set by an operator picking the ticket up. Null means nobody owns it. */
    assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),

    /** Drives queue ordering, so the oldest unanswered ticket surfaces first. */
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (table) => ({
    userIdx: index('support_tickets_user_idx').on(table.userId, table.lastMessageAt),
    queueIdx: index('support_tickets_queue_idx').on(table.status, table.lastMessageAt),
    assignedIdx: index('support_tickets_assigned_idx').on(table.assignedTo),
  }),
)

/**
 * Messages on a ticket. Append-only — there is no edit or delete path.
 *
 * What a customer was told, and when, is the whole value of this record. An
 * editable support history is one that can be quietly corrected after a
 * complaint, which is precisely when it matters most.
 */
export const supportMessages = pgTable(
  'support_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => supportTickets.id, { onDelete: 'cascade' }),

    /** Null once an author's account is gone; `authorRole` still says who it was. */
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    /**
     * Frozen at write time, deliberately duplicating `users.role`.
     *
     * If a customer is later made an operator, every message they ever sent
     * would otherwise re-render as having come from support. The transcript has
     * to stay true to what happened.
     */
    authorRole: userRoleEnum('author_role').notNull(),

    body: text('body').notNull(),

    /**
     * An operator's private note, never shown to the customer.
     *
     * The risk this carries is obvious and one-directional: a note wrongly
     * marked visible leaks an internal discussion to the person it is about.
     * So the customer-facing query filters on this column *in the query*, not
     * in a caller that could forget.
     */
    internal: boolean('internal').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ticketIdx: index('support_messages_ticket_idx').on(table.ticketId, table.createdAt),
  }),
)

export type SupportTicket = typeof supportTickets.$inferSelect
export type SupportMessage = typeof supportMessages.$inferSelect

/* ------------------------------------------------------------------ */
/* Reference data                                                      */
/* ------------------------------------------------------------------ */

export const planTierEnum = pgEnum('plan_tier', ['starter', 'advanced', 'pro'])

/**
 * How a plan's rate should be read.
 *
 * Not cosmetic. "5%" on a 30-day plan means wildly different things as a
 * per-term figure versus an annual one, and a customer who reads it the
 * generous way has been misled even if nobody intended it. Stored explicitly so
 * the figure can never be displayed without its basis.
 */
export const rateBasisEnum = pgEnum('rate_basis', ['per_term', 'annual'])

/**
 * Investment plans — the commercial terms shown to prospective customers.
 *
 * Note what this table does not have: a column for a rate of return, a
 * projected profit, or anything a visitor could read as a promise of
 * performance. That absence is deliberate and load-bearing. In most
 * jurisdictions a stated return is a regulated financial promotion, and an
 * unfounded one is unlawful — so there is no field for an operator to put one
 * in, rather than a warning asking them not to.
 *
 * `riskDisclosure` is NOT NULL for the mirror-image reason: a plan without a
 * plain statement that capital is at risk should not be publishable at all.
 *
 * Money columns are `numeric`, never float. `minimumAmount` and friends are
 * nullable because "not yet configured" is a real state the UI renders
 * honestly as "Set by operator" — distinct from a minimum of zero.
 */
export const investmentPlans = pgTable(
  'investment_plans',
  {
    /** Stable slug, e.g. "plan_starter". Referenced by subscriptions later. */
    id: varchar('id', { length: 32 }).primaryKey(),
    tier: planTierEnum('tier').notNull(),

    name: varchar('name', { length: 64 }).notNull(),
    summary: text('summary').notNull(),

    minimumAmount: numeric('minimum_amount', { precision: 20, scale: 2 }),
    maximumAmount: numeric('maximum_amount', { precision: 20, scale: 2 }),
    /** Platform fee as a percentage, e.g. 1.250 for 1.25%. */
    feePercent: numeric('fee_percent', { precision: 6, scale: 3 }),
    /** Term in days. Null means open-ended. */
    durationDays: integer('duration_days'),
    currency: varchar('currency', { length: 8 }).notNull().default('USD'),

    features: jsonb('features').$type<string[]>().notNull().default([]),
    riskDisclosure: text('risk_disclosure').notNull(),

    /**
     * The contractually promised return.
     *
     * This column is the thing that makes a plan a financial product rather
     * than a service tier. A figure here is a debt the business owes on
     * maturity whatever its own performance was, so:
     *
     * - `rateBasis` is required alongside it, because a bare percentage is
     *   ambiguous and the ambiguity always favours the seller.
     * - `yieldSource` is required to publish, because a promised return with
     *   no stated origin is unanswerable when a customer asks how it is
     *   generated — and that question has one honest answer or none.
     *
     * Null means the plan promises nothing, which remains a valid plan.
     */
    fixedRatePercent: numeric('fixed_rate_percent', { precision: 6, scale: 3 }),
    rateBasis: rateBasisEnum('rate_basis').notNull().default('per_term'),
    /** Where the money to pay the return actually comes from. */
    yieldSource: text('yield_source'),

    popular: boolean('popular').notNull().default(false),
    /**
     * Unpublished plans are invisible to the public, visible in admin.
     *
     * New plans start unpublished so a half-written set of terms cannot reach
     * a customer between the operator creating it and finishing it.
     */
    published: boolean('published').notNull().default(false),
    displayOrder: integer('display_order').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    orderIdx: index('investment_plans_order_idx').on(table.published, table.displayOrder),
    /**
     * A maximum below the minimum describes a plan nobody can subscribe to.
     * Enforced in the database as well as the API, because the API is not the
     * only thing that will ever write here.
     */
    amountRange: check(
      'investment_plans_amount_range',
      sql`${table.minimumAmount} is null or ${table.maximumAmount} is null or ${table.maximumAmount} >= ${table.minimumAmount}`,
    ),
    feeRange: check(
      'investment_plans_fee_range',
      sql`${table.feePercent} is null or (${table.feePercent} >= 0 and ${table.feePercent} <= 100)`,
    ),
    /**
     * A promised rate cannot be published without saying where the money comes
     * from, or without a term to measure it over. Enforced in the database
     * because the API is not the only thing that will ever write here, and a
     * published plan promising a return from nowhere is the exact shape of the
     * thing this product must not be.
     */
    promiseIsExplained: check(
      'investment_plans_promise_explained',
      sql`${table.fixedRatePercent} is null or ${table.published} = false or (${table.yieldSource} is not null and ${table.durationDays} is not null)`,
    ),
    rateRange: check(
      'investment_plans_rate_range',
      sql`${table.fixedRatePercent} is null or (${table.fixedRatePercent} >= 0 and ${table.fixedRatePercent} <= 1000)`,
    ),
  }),
)

export type InvestmentPlanRow = typeof investmentPlans.$inferSelect

export const assets = pgTable(
  'assets',
  {
    id: varchar('id', { length: 32 }).primaryKey(),
    symbol: varchar('symbol', { length: 16 }).notNull(),
    name: varchar('name', { length: 64 }).notNull(),
    color: varchar('color', { length: 9 }).notNull(),
    // Chain precision. BTC is 8, ETH is 18 — needed to reject unrepresentable amounts.
    decimals: integer('decimals').notNull(),
    network: varchar('network', { length: 64 }),
    /** Provider-specific id, e.g. CoinGecko's "bitcoin". */
    providerId: varchar('provider_id', { length: 64 }),
    tradable: boolean('tradable').notNull().default(false),
    displayOrder: integer('display_order').notNull().default(0),
  },
  (table) => ({
    symbolIdx: uniqueIndex('assets_symbol_idx').on(table.symbol),
  }),
)

/**
 * Cached market quotes.
 *
 * Cached server-side so every visitor doesn't burn provider quota, and so the
 * page still renders when the provider is briefly unavailable. `fetchedAt`
 * drives staleness, which the API surfaces rather than hiding.
 */
export const marketQuotes = pgTable(
  'market_quotes',
  {
    assetId: varchar('asset_id', { length: 32 })
      .primaryKey()
      .references(() => assets.id, { onDelete: 'cascade' }),

    price: numeric('price', { precision: 38, scale: 12 }).notNull(),
    change24h: numeric('change_24h', { precision: 38, scale: 12 }),
    changePercent24h: numeric('change_percent_24h', { precision: 12, scale: 4 }),
    high24h: numeric('high_24h', { precision: 38, scale: 12 }),
    low24h: numeric('low_24h', { precision: 38, scale: 12 }),
    volume24h: numeric('volume_24h', { precision: 38, scale: 2 }),
    marketCap: numeric('market_cap', { precision: 38, scale: 2 }),
    sparkline: jsonb('sparkline').$type<number[]>(),

    provider: varchar('provider', { length: 32 }).notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    fetchedAtIdx: index('market_quotes_fetched_at_idx').on(table.fetchedAt),
  }),
)

/* ------------------------------------------------------------------ */
/* Audit log                                                           */
/* ------------------------------------------------------------------ */

/**
 * Append-only record of security- and admin-relevant actions.
 *
 * In production, grant INSERT and SELECT only — no UPDATE or DELETE — so the
 * trail cannot be rewritten by the application or by a compromised account.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Nullable so unauthenticated and system events are still recorded.
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actorRole: userRoleEnum('actor_role'),

    action: varchar('action', { length: 64 }).notNull(),
    targetType: varchar('target_type', { length: 32 }),
    targetId: varchar('target_id', { length: 64 }),

    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    actorIdx: index('audit_log_actor_idx').on(table.actorId, table.createdAt),
    actionIdx: index('audit_log_action_idx').on(table.action, table.createdAt),
  }),
)

/* ------------------------------------------------------------------ */
/* Rate limiting                                                       */
/* ------------------------------------------------------------------ */

/**
 * Database-backed rate limiting.
 *
 * Correct across serverless instances, where an in-process counter is not:
 * each cold start would otherwise get its own fresh allowance.
 */
export const rateLimits = pgTable(
  'rate_limits',
  {
    key: varchar('key', { length: 160 }).primaryKey(),
    count: integer('count').notNull().default(0),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    windowIdx: index('rate_limits_window_idx').on(table.windowStart),
  }),
)

/* ------------------------------------------------------------------ */
/* Relations                                                           */
/* ------------------------------------------------------------------ */

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  kycRecords: many(kycRecords),
  loginEvents: many(loginEvents),
  recoveryCodes: many(recoveryCodes),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const kycRecordsRelations = relations(kycRecords, ({ one }) => ({
  user: one(users, { fields: [kycRecords.userId], references: [users.id] }),
}))

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof sessions.$inferSelect
export type KycRecord = typeof kycRecords.$inferSelect
export type AuditEntry = typeof auditLog.$inferSelect
