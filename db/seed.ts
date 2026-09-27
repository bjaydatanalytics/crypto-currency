/**
 * Database seed.
 *
 * Inserts reference data (the tradable asset list) and, when explicitly asked,
 * a first admin account.
 *
 * Run with:  npm run db:seed
 * Admin:     npm run db:seed -- --admin-email you@example.com --admin-password '...'
 *
 * Seeds NO customer accounts, balances or transactions. A financial database
 * should contain only records of things that actually happened.
 *
 * Deliberately standalone: it builds its own database connection instead of
 * importing `db/index.ts`. Those modules carry `server-only`, which by design
 * cannot be imported outside Next's server runtime — and weakening that guard
 * to suit a CLI script would remove a real protection from the application.
 */

import { config } from 'dotenv'
import { Pool, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import { hash } from '@node-rs/argon2'
import ws from 'ws'
import { assets, investmentPlans, users } from './schema'

config({ path: '.env.local' })

// Node below v22 has no global WebSocket; the Neon driver needs one.
if (typeof globalThis.WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws
}

/** Must match lib/server/crypto.ts, or seeded passwords won't verify. */
const ARGON_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.')
  }

  const pool = new Pool({ connectionString })
  const db = drizzle(pool)

  console.log('Seeding reference data…')

  /**
   * `providerId` maps to the market provider's identifier (CoinGecko ids here).
   * `tradable` stays false: nothing is tradable until a venue is connected.
   */
  const assetRows = [
    { id: 'btc', symbol: 'BTC', name: 'Bitcoin', color: '#F7931A', decimals: 8, network: 'Bitcoin', providerId: 'bitcoin', displayOrder: 1 },
    { id: 'eth', symbol: 'ETH', name: 'Ethereum', color: '#8A92B2', decimals: 18, network: 'Ethereum', providerId: 'ethereum', displayOrder: 2 },
    { id: 'sol', symbol: 'SOL', name: 'Solana', color: '#14F195', decimals: 9, network: 'Solana', providerId: 'solana', displayOrder: 3 },
    { id: 'usdt', symbol: 'USDT', name: 'Tether', color: '#26A17B', decimals: 6, network: 'Ethereum (ERC-20)', providerId: 'tether', displayOrder: 4 },
    { id: 'bnb', symbol: 'BNB', name: 'BNB', color: '#F3BA2F', decimals: 18, network: 'BNB Smart Chain', providerId: 'binancecoin', displayOrder: 5 },
    { id: 'xrp', symbol: 'XRP', name: 'XRP', color: '#23292F', decimals: 6, network: 'XRP Ledger', providerId: 'ripple', displayOrder: 6 },
  ]

  for (const asset of assetRows) {
    await db
      .insert(assets)
      .values({ ...asset, tradable: false })
      .onConflictDoUpdate({
        target: assets.id,
        // Refresh presentation and provider mapping, but never flip `tradable`
        // on — enabling trading is a deliberate operational decision.
        set: {
          symbol: asset.symbol,
          name: asset.name,
          color: asset.color,
          decimals: asset.decimals,
          network: asset.network,
          providerId: asset.providerId,
          displayOrder: asset.displayOrder,
        },
      })
  }
  console.log(`  ${assetRows.length} assets ready.`)

  /* ---------------- Investment plans ---------------- */

  /**
   * Plan tiers, seeded as **drafts with no commercial terms**.
   *
   * Every amount, fee and duration is null and `published` is false. That is
   * not laziness — those are commercial decisions only the operator can make,
   * and a seeded figure would be a made-up minimum sitting on a public page.
   * An operator fills them in at /admin/plans and publishes deliberately.
   *
   * The risk disclosures are seeded with real text because a plan cannot exist
   * without one, and these state the plain truth about market risk.
   */
  const planRows = [
    {
      id: 'plan_starter',
      tier: 'starter' as const,
      name: 'Starter',
      summary: 'For getting set up and learning how the platform works.',
      features: ['Portfolio tracking', 'Market access', 'Basic analytics', 'Email support', 'Mobile access'],
      riskDisclosure:
        'Digital assets are volatile and the value of your holdings can fall as well as rise. You may get back less than you put in. Nothing in this plan is a guarantee of return.',
      popular: false,
      displayOrder: 1,
    },
    {
      id: 'plan_advanced',
      tier: 'advanced' as const,
      name: 'Advanced',
      summary: 'For active investors who want deeper analysis and alerting.',
      features: ['Everything in Starter', 'Advanced analytics', 'Portfolio tools', 'Market alerts', 'Data export', 'Priority email support'],
      riskDisclosure:
        'Additional tools do not reduce market risk. Analytics and alerts are informational only and are not investment advice. You may get back less than you put in.',
      popular: true,
      displayOrder: 2,
    },
    {
      id: 'plan_pro',
      tier: 'pro' as const,
      name: 'Pro',
      summary: 'For high-volume users who need the full toolset and fast support.',
      features: ['Everything in Advanced', 'Advanced trading tools', 'Priority support', 'Additional platform features', 'API access', 'Dedicated account contact'],
      riskDisclosure:
        'Higher volume does not reduce risk, and no level of support or tooling can protect against market losses. You may get back less than you put in.',
      popular: false,
      displayOrder: 3,
    },
  ]

  for (const plan of planRows) {
    await db
      .insert(investmentPlans)
      .values({ ...plan, currency: 'USD', published: false })
      // Only the descriptive copy is refreshed on re-seed. Amounts, fees,
      // durations and `published` are left alone: re-running the seed must
      // never overwrite terms an operator configured, or un-publish a live plan.
      .onConflictDoUpdate({
        target: investmentPlans.id,
        set: {
          tier: plan.tier,
          name: plan.name,
          summary: plan.summary,
          features: plan.features,
          riskDisclosure: plan.riskDisclosure,
          displayOrder: plan.displayOrder,
        },
      })
  }
  console.log(`  ${planRows.length} plans ready (drafts, no terms set).`)

  /* ---------------- Optional first admin ---------------- */

  const args = process.argv.slice(2)
  const emailIndex = args.indexOf('--admin-email')
  const passwordIndex = args.indexOf('--admin-password')

  if (emailIndex !== -1 && passwordIndex !== -1) {
    const email = args[emailIndex + 1]?.toLowerCase()
    const password = args[passwordIndex + 1]

    if (!email || !password) {
      throw new Error('Both --admin-email and --admin-password need a value.')
    }
    if (password.length < 12) {
      // Stricter than the user-facing policy: this account can read every record.
      throw new Error('Admin password must be at least 12 characters.')
    }

    const passwordHash = await hash(password, ARGON_OPTIONS)

    const [admin] = await db
      .insert(users)
      .values({
        email,
        firstName: 'Platform',
        lastName: 'Administrator',
        passwordHash,
        role: 'admin',
        // Bootstrap account: pre-verified, since it predates any mailbox flow.
        emailVerifiedAt: new Date(),
        acceptedTermsAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.email,
        set: { role: 'admin', passwordHash },
      })
      .returning()

    console.log(`  Admin ready: ${admin.email}`)
    console.log('  Enable two-factor authentication on this account before going live.')
  } else {
    console.log('  No admin created. Pass --admin-email and --admin-password to create one.')
  }

  console.log('Seed complete.')
  await pool.end()
  process.exit(0)
}

main().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
