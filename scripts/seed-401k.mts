/**
 * Creates the 401k (retirement) plans as UNPUBLISHED drafts.
 *
 *   npx tsx scripts/seed-401k.mts --dry-run
 *   npx tsx scripts/seed-401k.mts
 *
 * These carry `category = 'retirement'`, which is what puts them on the 401k
 * page instead of the general plans grid.
 *
 * The source design showed this plan as paying "EVERY 24 HOUR(S) FOR LIFETIME"
 * with an unlimited return. That cannot be stored: the database refuses to
 * publish a promised rate without a term
 * (`investment_plans_promise_explained`), and nothing in the payout path can
 * pay a return forever — `cron/maturities` matures a contract once. An
 * unbounded promise is also an unbounded liability against a treasury that has
 * to cover it. So the plan is modelled as a real 365-day term at the same
 * daily rate, which the card renders as "every 24 hours for 365 days".
 *
 * `yield_source` is left NULL, exactly as the first nine were: publishing is
 * blocked until an operator states where the money comes from.
 */

import { config } from 'dotenv'

config({ path: '.env.local' })

const { neon } = await import('@neondatabase/serverless')

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is not set — check .env.local')

const sql = neon(databaseUrl)
const dryRun = process.argv.includes('--dry-run')

const RISK_DISCLOSURE =
  'Capital is at risk and this is not a pension. A retirement plan on this platform is an ' +
  'ordinary fixed-term investment contract with a long term, not a regulated retirement ' +
  'product, and no deposit guarantee or pension protection scheme covers it. Your funds are ' +
  'locked for the full term and you may get back less than you put in.'

interface RetirementSeed {
  id: string
  name: string
  summary: string
  min: number
  max: number
  /** Return credited per 24-hour period, as a percentage of principal. */
  perDayPercent: number
  durationDays: number
  displayOrder: number
}

const PLANS: RetirementSeed[] = [
  {
    id: 'plan_401k_samsung',
    name: 'Samsung',
    summary: 'Retirement position paying 1.10% a day across a 365-day term.',
    min: 100,
    max: 10_500,
    perDayPercent: 1.1,
    durationDays: 365,
    displayOrder: 10,
  },
]

/* ------------------------------------------------------------------ */

const [admin] = await sql`select id, email from users where role = 'admin' order by created_at limit 1`
if (!admin) throw new Error('No admin user found to attribute these drafts to.')

console.log(`Attributing to admin: ${admin.email}`)
if (dryRun) console.log('\nDRY RUN — nothing will be written.\n')

let created = 0

for (const plan of PLANS) {
  const totalRate = plan.perDayPercent * plan.durationDays
  const maxEarn = (plan.max * totalRate) / 100

  const line =
    `${plan.name.padEnd(12)} ${plan.perDayPercent.toFixed(2)}%/day × ${plan.durationDays}d` +
    ` = ${totalRate.toFixed(1)}% total` +
    `  $${plan.min.toLocaleString()}–$${plan.max.toLocaleString()}` +
    `  max earn $${maxEarn.toLocaleString()}`

  const [existing] = await sql`select id from investment_plans where id = ${plan.id}`
  if (existing) {
    console.log(`  SKIP    ${line}  (already exists)`)
    continue
  }
  if (dryRun) {
    console.log(`  WOULD   ${line}`)
    created++
    continue
  }

  await sql`
    insert into investment_plans (
      id, tier, category, name, summary,
      minimum_amount, maximum_amount, fee_percent, duration_days, currency,
      features, risk_disclosure,
      fixed_rate_percent, rate_basis, yield_source,
      popular, published, display_order, updated_by
    ) values (
      ${plan.id}, 'pro', 'retirement', ${plan.name}, ${plan.summary},
      ${plan.min.toFixed(2)}, ${plan.max.toFixed(2)}, ${null}, ${plan.durationDays}, 'USD',
      ${JSON.stringify([])}, ${RISK_DISCLOSURE},
      ${totalRate.toFixed(3)}, 'per_term', ${null},
      false, false, ${plan.displayOrder}, ${admin.id}
    )`

  await sql`
    insert into audit_log (actor_id, actor_role, action, target_type, target_id, metadata)
    values (
      ${admin.id}, 'admin', 'plan.created', 'investment_plan', ${plan.id},
      ${JSON.stringify({
        name: plan.name,
        category: 'retirement',
        published: false,
        fixedRatePercent: totalRate,
        durationDays: plan.durationDays,
        yieldSource: null,
        source: 'scripts/seed-401k.mts',
      })}
    )`

  console.log(`  CREATED ${line}`)
  created++
}

console.log(`\n${dryRun ? 'Would create' : 'Created'} ${created} retirement plan(s).`)
console.log(
  'UNPUBLISHED with no yield_source. Review the plan NAME before publishing —\n' +
    '"Samsung" is a third party\'s trademark and naming a financial product after it\n' +
    'may imply a backing or endorsement that does not exist.',
)

process.exit(0)
