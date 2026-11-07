/**
 * Creates the nine customer-facing investment plans as UNPUBLISHED drafts.
 *
 *   npx tsx scripts/seed-plans.mts            # insert drafts (skips existing)
 *   npx tsx scripts/seed-plans.mts --dry-run  # print what would be written
 *
 * Idempotent: a plan whose id already exists is left exactly as it is, so
 * re-running can never overwrite terms an operator has since edited.
 *
 * Two deliberate omissions, both of which must be filled in before publishing:
 *
 * 1. `yield_source` is NULL. The database enforces
 *    `investment_plans_promise_explained`, which permits a NULL yield source
 *    only while `published = false`. Publishing any of these will fail until
 *    someone writes where the money to pay the return actually comes from.
 *    That sentence is a statement about the business and cannot be generated.
 *
 * 2. `fee_percent` is NULL rather than copied from the existing plans, whose
 *    fees (2%, 20%, 16%) are service-tier fees and have no bearing on these.
 *
 * `risk_disclosure` reuses the wording already on the matching existing plan
 * so nothing here invents a new risk statement.
 *
 * Rates are stored the way the schema models them: `fixed_rate_percent` is the
 * TOTAL return over the term and `duration_days` is the term. The customer UI
 * renders the "X% every 24 hours for N days" form by dividing one by the other.
 */

import { config } from 'dotenv'

config({ path: '.env.local' })

const { neon } = await import('@neondatabase/serverless')

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is not set — check .env.local')

const sql = neon(databaseUrl)
const dryRun = process.argv.includes('--dry-run')

/** Shared across every tier: the return is promised, not projected. */
const RISK_BY_TIER: Record<'starter' | 'advanced' | 'pro', string> = {
  starter:
    'Capital is at risk. A promised return is only as good as the business behind it, and you may get back less than you put in.',
  advanced:
    'Capital is at risk. A higher promised return reflects a higher chance that it is not paid, and you may get back less than you put in.',
  pro: 'Capital is at risk. The largest promised returns carry the greatest chance of non-payment, and you may get back less than you put in.',
}

interface PlanSeed {
  id: string
  tier: 'starter' | 'advanced' | 'pro'
  name: string
  summary: string
  min: number
  max: number
  /** Total return over the whole term, as a percentage of principal. */
  totalRatePercent: number
  /** Term in days. One payout period is 24 hours. */
  durationDays: number
  displayOrder: number
}

/**
 * The nine plans, in the order the panel shows them.
 *
 * `totalRatePercent / durationDays` is the per-day figure the card leads with,
 * so every row below reproduces its screenshot exactly: STARTER is 5% over one
 * day, VIP GROUP PLAN is 300% over thirty (10% a day).
 */
const PLANS: PlanSeed[] = [
  { id: 'plan_starter_roi', tier: 'starter', name: 'Starter', summary: 'Entry plan. 5% total return paid over a single day.', min: 200, max: 1_999, totalRatePercent: 5, durationDays: 1, displayOrder: 10 },
  { id: 'plan_smart', tier: 'starter', name: 'Smart', summary: '8% total return paid over two days.', min: 2_000, max: 3_999, totalRatePercent: 8, durationDays: 2, displayOrder: 20 },
  { id: 'plan_professional', tier: 'starter', name: 'Professional', summary: '12% total return paid over three days.', min: 4_000, max: 7_999, totalRatePercent: 12, durationDays: 3, displayOrder: 30 },
  { id: 'plan_potential', tier: 'advanced', name: 'Potential', summary: '16% total return paid over four days.', min: 8_000, max: 9_999, totalRatePercent: 16, durationDays: 4, displayOrder: 40 },
  { id: 'plan_compounding', tier: 'advanced', name: 'Compounding', summary: '30% total return paid over six days.', min: 10_000, max: 19_999, totalRatePercent: 30, durationDays: 6, displayOrder: 50 },
  { id: 'plan_premium', tier: 'advanced', name: 'Premium', summary: '60% total return paid over ten days.', min: 20_000, max: 29_999, totalRatePercent: 60, durationDays: 10, displayOrder: 60 },
  { id: 'plan_high_return', tier: 'pro', name: 'High Return', summary: '90% total return paid over eighteen days.', min: 30_000, max: 39_999, totalRatePercent: 90, durationDays: 18, displayOrder: 70 },
  { id: 'plan_vip_miner', tier: 'pro', name: 'VIP Miner', summary: '120% total return paid over twenty-four days.', min: 40_000, max: 1_000_000_000, totalRatePercent: 120, durationDays: 24, displayOrder: 80 },
  { id: 'plan_vip_group', tier: 'pro', name: 'VIP Group Plan', summary: '300% total return paid over thirty days.', min: 100_000, max: 1_000_000_000, totalRatePercent: 300, durationDays: 30, displayOrder: 90 },
]

/* ------------------------------------------------------------------ */

const [admin] = await sql`select id, email from users where role = 'admin' order by created_at limit 1`
if (!admin) throw new Error('No admin user found to attribute these drafts to.')

console.log(`Attributing to admin: ${admin.email}`)
console.log(dryRun ? '\nDRY RUN — nothing will be written.\n' : '')

let created = 0
let skipped = 0

for (const plan of PLANS) {
  const perDay = plan.totalRatePercent / plan.durationDays
  const maxEarn = (plan.max * plan.totalRatePercent) / 100

  const line =
    `${plan.name.padEnd(16)} ${perDay.toFixed(2).padStart(6)}%/day × ${String(plan.durationDays).padStart(2)}d` +
    ` = ${String(plan.totalRatePercent).padStart(3)}% total` +
    `  $${plan.min.toLocaleString()}–$${plan.max.toLocaleString()}` +
    `  max earn $${maxEarn.toLocaleString()}`

  const [existing] = await sql`select id from investment_plans where id = ${plan.id}`
  if (existing) {
    console.log(`  SKIP    ${line}  (already exists)`)
    skipped++
    continue
  }

  if (dryRun) {
    console.log(`  WOULD   ${line}`)
    created++
    continue
  }

  await sql`
    insert into investment_plans (
      id, tier, name, summary,
      minimum_amount, maximum_amount, fee_percent, duration_days, currency,
      features, risk_disclosure,
      fixed_rate_percent, rate_basis, yield_source,
      popular, published, display_order, updated_by
    ) values (
      ${plan.id}, ${plan.tier}, ${plan.name}, ${plan.summary},
      ${plan.min.toFixed(2)}, ${plan.max.toFixed(2)}, ${null}, ${plan.durationDays}, 'USD',
      ${JSON.stringify([])}, ${RISK_BY_TIER[plan.tier]},
      ${plan.totalRatePercent.toFixed(3)}, 'per_term', ${null},
      false, false, ${plan.displayOrder}, ${admin.id}
    )`

  await sql`
    insert into audit_log (actor_id, actor_role, action, target_type, target_id, metadata)
    values (
      ${admin.id}, 'admin', 'plan.created', 'investment_plan', ${plan.id},
      ${JSON.stringify({
        name: plan.name,
        tier: plan.tier,
        published: false,
        fixedRatePercent: plan.totalRatePercent,
        rateBasis: 'per_term',
        yieldSource: null,
        source: 'scripts/seed-plans.mts',
      })}
    )`

  console.log(`  CREATED ${line}`)
  created++
}

console.log(
  `\n${dryRun ? 'Would create' : 'Created'} ${created} draft plan(s); skipped ${skipped}.`,
)
console.log(
  'All are UNPUBLISHED and have no yield_source. Set one per plan in /admin/plans\n' +
    'before publishing — the database will reject publishing without it.',
)

process.exit(0)
