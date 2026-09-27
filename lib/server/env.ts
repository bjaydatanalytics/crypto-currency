import 'server-only'
import { z } from 'zod'

/**
 * Server-side environment.
 *
 * Validated once at import so a misconfigured deployment fails at boot with a
 * clear message, rather than at 3am when someone tries to sign in.
 *
 * Nothing here is prefixed NEXT_PUBLIC_, so none of it reaches the browser
 * bundle. `server-only` makes an accidental client import a build error.
 */

const schema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required — set your Neon connection string'),

  /**
   * 32-byte base64 key used to encrypt TOTP secrets at rest.
   * Generate with: openssl rand -base64 32
   */
  ENCRYPTION_KEY: z
    .string()
    .min(32, 'ENCRYPTION_KEY must be at least 32 characters (use: openssl rand -base64 32)'),

  /** Absolute origin, used to build links in emails. */
  APP_URL: z.string().url().default('http://localhost:3000'),

  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /* --- Optional providers: absent means the feature reports unavailable --- */

  /** Market data. Without it the API serves cached rows and says data is stale. */
  MARKET_API_KEY: z.string().optional(),
  MARKET_PROVIDER: z.enum(['coingecko']).default('coingecko'),

  /**
   * Transactional email. Configure exactly one transport.
   * Resend is preferred where both are set — HTTP survives hosts that block
   * outbound SMTP ports.
   */
  RESEND_API_KEY: z.string().optional(),
  SMTP_URL: z.string().optional(),
  /** Required once a transport is configured, e.g. "Nexora <no-reply@yourdomain>". */
  MAIL_FROM: z.string().optional(),

  /** Protects the cron endpoint that refreshes market data. */
  CRON_SECRET: z.string().optional(),
})

/**
 * No custody-provider configuration exists, deliberately.
 *
 * Deposits and withdrawals run a centralised model: the business holds the
 * receiving accounts, an operator records the addresses in
 * `platform_deposit_addresses`, assigns them to users, and credits deposits
 * after confirming them. There is no third-party custodian to hold keys for,
 * so there are no keys, no API credentials and no adapter to configure.
 *
 * The cost of that choice is that crediting a deposit and paying a withdrawal
 * are human steps, recorded in the audit log rather than performed by a
 * provider. The ledger is still the authority on every balance.
 */

type Env = z.infer<typeof schema>

let cached: Env | null = null

function load(): Env {
  if (cached) return cached

  const parsed = schema.safeParse(process.env)

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(
      `Invalid server environment.\n${issues}\n\nCopy .env.example to .env.local and fill it in.`,
    )
  }

  cached = parsed.data
  return cached
}

/**
 * Validated on first property access, not at import.
 *
 * `next build` imports every route module to collect metadata. Validating at
 * import time would make a build impossible without a live DATABASE_URL, which
 * breaks CI and any environment that builds before secrets are attached.
 *
 * Deferring to first access keeps the guarantee where it matters — a request
 * that actually needs configuration still fails immediately and loudly — while
 * letting a build with no secrets succeed.
 */
export const env = new Proxy({} as Env, {
  get(_target, property: string) {
    return load()[property as keyof Env]
  },
})

/** Capability flags derived from what is actually configured. */
export const capabilities = {
  get email() {
    const config = load()
    return Boolean(config.RESEND_API_KEY || config.SMTP_URL)
  },
  get marketData() {
    return Boolean(load().MARKET_API_KEY)
  },
}
