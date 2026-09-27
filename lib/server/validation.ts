import { z } from 'zod'

/**
 * Request schemas.
 *
 * Server-side validation is the real validation — the client-side checks in the
 * forms are a convenience for the user and can be bypassed entirely.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(320)
  .email('Enter a valid email address.')
  .transform((value) => value.toLowerCase())

/**
 * Password policy: length over composition rules.
 *
 * Forced symbol/digit classes push people toward "Password1!" patterns that are
 * easy to guess. Length is what actually resists cracking, so the floor is 10
 * and the ceiling is high enough for passphrases. Argon2 has no practical
 * length limit, but capping input prevents a DoS via megabyte passwords.
 */
export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(200, 'Password is too long.')

const nameSchema = z
  .string()
  .trim()
  .min(1, 'This field is required.')
  .max(100, 'This is too long.')
  // Letters, marks, spaces, hyphens and apostrophes — covers non-Latin names.
  .regex(/^[\p{L}\p{M}][\p{L}\p{M}\s'\-.]*$/u, 'Enter a valid name.')

export const registerSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  acceptedTerms: z
    .boolean()
    .refine((value) => value, 'You must accept the terms to create an account.'),
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.').max(200),
  totpCode: z.string().trim().max(16).optional(),
  remember: z.boolean().optional(),
})

export const forgotPasswordSchema = z.object({ email: emailSchema })

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(200),
  password: passwordSchema,
})

export const verifyEmailSchema = z.object({
  token: z.string().min(6).max(200),
})

export const resendVerificationSchema = z.object({ email: emailSchema })

export const enableTwoFactorSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the six-digit code from your authenticator app.'),
})

export const disableTwoFactorSchema = z.object({
  password: z.string().min(1, 'Enter your password.').max(200),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.').max(200),
  newPassword: passwordSchema,
})

export const updateProfileSchema = z.object({
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  phone: z
    .string()
    .trim()
    .max(32)
    .regex(/^[+]?[\d\s()-]{6,32}$/, 'Enter a valid phone number.')
    .optional()
    .or(z.literal('')),
  country: z
    .string()
    .trim()
    .length(2, 'Use a two-letter country code.')
    .toUpperCase()
    .optional()
    .or(z.literal('')),
})

/**
 * KYC submission.
 *
 * Note what is absent: no document images, no passport or ID numbers. Those go
 * directly to the KYC provider, which is built and contracted to hold them.
 * This endpoint records only that a submission was made and its reference.
 */
export const kycSubmitSchema = z.object({
  providerReference: z.string().trim().min(1).max(128),
})

export const adminUserQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.enum(['active', 'suspended', 'closed']).optional(),
  kycStatus: z.enum(['unverified', 'pending', 'verified', 'rejected']).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
})

/* ------------------------------------------------------------------ */
/* Receiving addresses                                                 */
/* ------------------------------------------------------------------ */

const DEPOSIT_NETWORK_ID = /^[a-z0-9-]{2,32}$/

/**
 * A new platform receiving address.
 *
 * `confirmAddress` is required and must match exactly. Re-entering it catches
 * a truncated paste and a one-shot clipboard swap — both of which produce a
 * string that still looks like an address. The checksum validation in
 * `lib/server/address-validation.ts` runs afterwards and catches the rest.
 * Neither check is redundant: one catches wrong-but-valid, the other
 * wrong-and-invalid.
 */
export const createDepositAddressSchema = z
  .object({
    assetId: z.string().trim().min(1).max(32).toLowerCase(),
    network: z.string().trim().regex(DEPOSIT_NETWORK_ID, 'Choose a supported network.'),
    address: z.string().trim().min(16, 'That is too short to be an address.').max(128),
    confirmAddress: z.string().trim().min(1, 'Enter the address a second time.').max(128),
    addressTag: z.string().trim().max(64).optional().or(z.literal('')),
    label: z
      .string()
      .trim()
      .min(3, 'Give this address a name you will recognise later.')
      .max(96),
    custodian: z
      .string()
      .trim()
      .min(2)
      .max(32)
      .regex(/^[\w-]+$/, 'Use a short identifier, e.g. "bybit".'),
    notes: z.string().trim().max(500).optional().or(z.literal('')),
  })
  .refine((value) => value.address === value.confirmAddress, {
    message: 'The two addresses do not match. Check both before saving.',
    path: ['confirmAddress'],
  })

export const updateDepositAddressSchema = z.object({
  status: z.enum(['revoked'], {
    message: 'An address can only be retired. Add a new one to replace it.',
  }),
})

export const assignDepositAddressSchema = z.object({
  userId: z.string().uuid('Choose a user.'),
  platformAddressId: z.string().uuid('Choose an address.'),
})

export const depositAddressQuerySchema = z.object({
  assetId: z.string().trim().max(32).toLowerCase().optional(),
  network: z.string().trim().max(32).optional(),
  status: z.enum(['active', 'revoked']).optional(),
})

export const assignmentQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  sourceAddressId: z.string().uuid().optional(),
  includeRevoked: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
})

/**
 * Preferences.
 *
 * `displayCurrency` and `language` accept only the values that actually work
 * today. Accepting 'EUR' would store a preference that no code honours — the
 * quotes are cached in USD and nothing converts them — which is the same
 * dishonesty as a checkbox that saves nothing, just harder to spot.
 *
 * There is no field for security alerts: they cannot be switched off.
 */
export const updatePreferencesSchema = z
  .object({
    transactionEmails: z.boolean().optional(),
    marketingEmails: z.boolean().optional(),
    analyticsConsent: z.boolean().optional(),
    displayCurrency: z
      .enum(['USD'], { message: 'Only USD is supported until an exchange-rate source is wired up.' })
      .optional(),
    language: z
      .enum(['en'], { message: 'Only English is available until translations exist.' })
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update.')

/* ------------------------------------------------------------------ */
/* Support                                                             */
/* ------------------------------------------------------------------ */

const ticketBodySchema = z
  .string()
  .trim()
  .min(10, 'Describe the problem — a few words is not enough to act on.')
  .max(5000, 'That is too long. Attach detail in a follow-up reply instead.')

export const createTicketSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(4, 'Give it a short subject.')
    .max(200),
  category: z.enum(['account', 'verification', 'deposit', 'withdrawal', 'investment', 'other']),
  body: ticketBodySchema,
})

export const ticketReplySchema = z.object({
  body: ticketBodySchema,
})

/**
 * Operator actions on a ticket.
 *
 * `internal` exists only here, on the admin side. A customer has no way to
 * write a private note, because the notion is meaningless from their side and
 * accepting the field would be one validation slip away from a customer
 * writing something an operator assumes only staff can see.
 */
export const adminTicketActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('reply'),
    body: ticketBodySchema,
    internal: z.boolean().default(false),
  }),
  z.object({
    action: z.literal('status'),
    status: z.enum(['awaiting_support', 'awaiting_customer', 'resolved', 'closed']),
  }),
  z.object({
    action: z.literal('assign'),
    /** Null releases the ticket back to the unassigned queue. */
    assignedTo: z.string().uuid().nullable(),
  }),
  z.object({
    action: z.literal('priority'),
    priority: z.enum(['low', 'normal', 'high']),
  }),
])

export const ticketQuerySchema = z.object({
  status: z.enum(['awaiting_support', 'awaiting_customer', 'resolved', 'closed']).optional(),
  assignedTo: z.string().uuid().optional(),
  unassigned: z.coerce.boolean().optional(),
})

/* ------------------------------------------------------------------ */
/* Investments                                                         */
/* ------------------------------------------------------------------ */

export const subscribeToPlanSchema = z.object({
  planId: z.string().trim().min(1).max(32),
  assetId: z.string().trim().min(1).max(32).toLowerCase(),
  /** Decimal string, never a float — see `decimalAmountSchema` below. */
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,18})?$/, 'Enter a valid amount.')
    .refine((value) => Number(value) > 0, 'Amount must be greater than zero.'),
  /** Client-supplied so a double-submit cannot open two contracts. */
  idempotencyKey: z.string().trim().min(8).max(200),
  /**
   * The customer must actively confirm the terms.
   *
   * Not decoration: a fixed-return contract is an agreement, and a record that
   * they were shown the rate, the term and the risk statement before agreeing
   * is the thing a dispute turns on.
   */
  acceptedTerms: z
    .boolean()
    .refine((value) => value, 'You must accept the plan terms to continue.'),
})

export const adminInvestmentActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('mature') }),
  z.object({
    action: z.literal('cancel'),
    reason: z.string().trim().min(4, 'Say why — the customer will be told.').max(500),
  }),
])

export const fundTreasurySchema = z.object({
  assetId: z.string().trim().min(1).max(32).toLowerCase(),
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,18})?$/, 'Enter a valid amount.')
    .refine((value) => Number(value) > 0, 'Amount must be greater than zero.'),
  note: z.string().trim().max(200).optional().or(z.literal('')),
  idempotencyKey: z.string().trim().min(8).max(200),
})

export const investmentQuerySchema = z.object({
  status: z.enum(['active', 'matured', 'cancelled']).optional(),
})

/* ------------------------------------------------------------------ */
/* Operator money movements                                            */
/* ------------------------------------------------------------------ */

/**
 * A decimal amount, kept as a string the whole way down.
 *
 * Never `z.number()`. A JavaScript number is an IEEE-754 double and cannot
 * represent 0.1 exactly, let alone 18 decimal places of wei — parsing an
 * amount to a float and back is how a balance ends up off by a rounding error
 * that belongs to a real person.
 */
const decimalAmountSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,18})?$/, 'Enter a valid amount, e.g. 0.5 or 1250.75.')
  .refine((value) => Number(value) > 0, 'Amount must be greater than zero.')

/**
 * A transaction hash.
 *
 * Accepts the forms the supported chains actually produce: 0x-prefixed hex on
 * EVM chains, bare hex on Bitcoin and Tron, base58 on Solana. Kept permissive
 * on shape but required on presence — a recorded deposit with no hash cannot
 * be verified by anyone afterwards, including the customer disputing it.
 */
const txHashSchema = z
  .string()
  .trim()
  .min(16, 'That is too short to be a transaction hash.')
  .max(128)
  .regex(/^[\w:-]+$/, 'A transaction hash has no spaces or punctuation.')

export const recordDepositSchema = z.object({
  userId: z.string().uuid('Choose a user.'),
  assetId: z.string().trim().min(1).max(32).toLowerCase(),
  network: z.string().trim().max(32).optional(),
  amount: decimalAmountSchema,
  txHash: txHashSchema,
  confirmations: z.coerce
    .number()
    .int('Enter a whole number.')
    .min(0, 'Confirmations cannot be negative.')
    .max(1_000_000),
  notes: z.string().trim().max(128).optional().or(z.literal('')),
})

export const depositActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('credit') }),
  z.object({
    action: z.literal('reject'),
    reason: z
      .string()
      .trim()
      .min(4, 'Say why — this is what the customer will be told.')
      .max(500),
  }),
  z.object({
    action: z.literal('confirmations'),
    confirmations: z.coerce.number().int().min(0).max(1_000_000),
  }),
])

export const withdrawalActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve') }),
  z.object({ action: z.literal('settle'), txHash: txHashSchema }),
  z.object({
    action: z.literal('reject'),
    reason: z
      .string()
      .trim()
      .min(4, 'Say why — this is what the customer will be told.')
      .max(500),
  }),
])

export const depositReviewQuerySchema = z.object({
  status: z.enum(['detected', 'confirming', 'credited', 'rejected', 'failed']).optional(),
  userId: z.string().uuid().optional(),
})

export const withdrawalReviewQuerySchema = z.object({
  status: z.enum(['pending_approval', 'approved', 'completed', 'rejected']).optional(),
})

/* ------------------------------------------------------------------ */
/* Investment plans                                                    */
/* ------------------------------------------------------------------ */

/**
 * A nullable money figure.
 *
 * `null` is meaningful and distinct from zero: it is "not yet configured",
 * which the public cards render as "Set by operator" rather than as a $0
 * minimum a visitor would read as a real term.
 */
const nullableAmount = z
  .number()
  .min(0, 'Cannot be negative.')
  .max(1_000_000_000, 'That is implausibly large — check the figure.')
  .nullable()

/**
 * The risk disclosure, required on every plan.
 *
 * There is no field anywhere in this schema for a rate of return or a
 * projected profit, and that is deliberate: a stated return is a regulated
 * financial promotion in most jurisdictions. The disclosure is the
 * counterweight, so it cannot be left empty or reduced to a word.
 */
const riskDisclosureSchema = z
  .string()
  .trim()
  .min(40, 'State plainly that capital is at risk. One or two sentences minimum.')
  .max(1000)

/**
 * The promised rate.
 *
 * Capped at 1000% to catch a typo, not to bless anything near it. A plan
 * offering 200% is not made legitimate by passing validation — the cap exists
 * so a stray keystroke cannot commit the business to a debt three orders of
 * magnitude larger than intended.
 */
const fixedRateSchema = z
  .number()
  .min(0, 'A rate cannot be negative.')
  .max(1000, 'That is almost certainly a typo. Check the figure.')
  .nullable()

const yieldSourceSchema = z
  .string()
  .trim()
  .min(20, 'Say where the money to pay this return actually comes from.')
  .max(500)

const planFields = {
  tier: z.enum(['starter', 'advanced', 'pro']),
  /** Null means the plan promises no return, which remains valid. */
  fixedRatePercent: fixedRateSchema,
  rateBasis: z.enum(['per_term', 'annual']),
  yieldSource: yieldSourceSchema.nullable(),
  name: z.string().trim().min(2, 'Give the plan a name.').max(64),
  summary: z.string().trim().min(10, 'Describe who this tier is for.').max(300),
  minimumAmount: nullableAmount,
  maximumAmount: nullableAmount,
  fee: z.number().min(0).max(100, 'A fee above 100% is not a fee.').nullable(),
  duration: z
    .number()
    .int('Use whole days.')
    .min(1, 'Use at least one day, or leave blank for open-ended.')
    .max(36_500)
    .nullable(),
  currency: z.string().trim().length(3, 'Use a three-letter code.').toUpperCase(),
  features: z
    .array(z.string().trim().min(1).max(80))
    .max(20, 'Twenty features is plenty.')
    .default([]),
  riskDisclosure: riskDisclosureSchema,
  popular: z.boolean().default(false),
  published: z.boolean().default(false),
  displayOrder: z.number().int().min(0).max(9999).default(0),
}

/** The range check is repeated here and in the database — neither is the only writer. */
const amountRangeCheck = (value: { minimumAmount: number | null; maximumAmount: number | null }) =>
  value.minimumAmount === null ||
  value.maximumAmount === null ||
  value.maximumAmount >= value.minimumAmount

/**
 * A promised return must be explained before it can be published.
 *
 * Mirrors the database CHECK constraint rather than replacing it. A published
 * plan promising a rate with no term to measure it over and no stated source of
 * the money is the exact artefact this product must never produce, so it is
 * blocked in two independent places.
 */
const promiseIsExplained = (value: {
  fixedRatePercent: number | null
  published: boolean
  duration: number | null
  yieldSource: string | null
}) =>
  value.fixedRatePercent === null ||
  !value.published ||
  (value.duration !== null && value.yieldSource !== null)

const PROMISE_MESSAGE =
  'A plan that promises a return cannot be published without a term and a statement of where the money comes from.'

export const createPlanSchema = z
  .object(planFields)
  .refine(amountRangeCheck, {
    message: 'The maximum cannot be below the minimum.',
    path: ['maximumAmount'],
  })
  .refine(promiseIsExplained, { message: PROMISE_MESSAGE, path: ['yieldSource'] })

export const updatePlanSchema = z
  .object({
    tier: planFields.tier.optional(),
    name: planFields.name.optional(),
    summary: planFields.summary.optional(),
    minimumAmount: nullableAmount.optional(),
    maximumAmount: nullableAmount.optional(),
    fee: planFields.fee.optional(),
    duration: planFields.duration.optional(),
    currency: planFields.currency.optional(),
    features: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    riskDisclosure: riskDisclosureSchema.optional(),
    popular: z.boolean().optional(),
    published: z.boolean().optional(),
    displayOrder: z.number().int().min(0).max(9999).optional(),
    fixedRatePercent: fixedRateSchema.optional(),
    rateBasis: z.enum(['per_term', 'annual']).optional(),
    yieldSource: yieldSourceSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update.')

export const adminUpdateUserSchema = z.object({
  status: z.enum(['active', 'suspended', 'closed']).optional(),
  kycStatus: z.enum(['unverified', 'pending', 'verified', 'rejected']).optional(),
  rejectionReason: z.string().trim().max(500).optional(),
})
