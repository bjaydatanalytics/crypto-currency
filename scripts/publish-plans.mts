/**
 * Sets the yield source on the nine seeded plans, publishes them, and removes
 * the three original service-tier plans.
 *
 *   npx tsx scripts/publish-plans.mts --dry-run   # show what would change
 *   npx tsx scripts/publish-plans.mts             # apply
 *
 * The yield source below was supplied by the operator: returns are funded from
 * the firm's own proprietary trading revenue and reserves. It is stored
 * verbatim on every plan, because the database refuses to publish a promised
 * rate without one (`investment_plans_promise_explained`).
 *
 * Deleting the originals is guarded twice: this script refuses if any
 * `investments` row references a plan, and `investments.plan_id` is declared
 * `onDelete: 'restrict'`, so the database would reject it regardless.
 *
 * Idempotent — re-running publishes nothing new and deletes nothing twice.
 */

import { config } from 'dotenv'

config({ path: '.env.local' })

const { neon } = await import('@neondatabase/serverless')

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is not set — check .env.local')

const sql = neon(databaseUrl)
const dryRun = process.argv.includes('--dry-run')

/**
 * Where the money to pay these returns comes from.
 *
 * Three claims, each of which the platform can actually stand behind:
 * the origin of the funds, that the return is a debt rather than a share of
 * performance, and that payouts come from the funded treasury. The last one
 * is enforced in code — `lib/server/investments.ts` refuses to mature a
 * contract the treasury cannot cover, so it cannot quietly become false.
 */
const YIELD_SOURCE =
  'Returns are funded from Nexora’s own proprietary trading revenue and capital reserves. ' +
  'The firm trades its own capital on cryptocurrency markets, and the return promised by this plan ' +
  'is a fixed obligation of the business — it is owed in full on maturity whether or not that ' +
  'trading was profitable in any given period, and it is not a share of trading performance. ' +
  'Payouts are made only from the funded platform treasury; no customer’s return is ever paid ' +
  'out of another customer’s deposit.'

/** The plans seeded by scripts/seed-plans.mts. */
const PUBLISH_IDS = [
  'plan_starter_roi',
  'plan_smart',
  'plan_professional',
  'plan_potential',
  'plan_compounding',
  'plan_premium',
  'plan_high_return',
  'plan_vip_miner',
  'plan_vip_group',
]

/** The original service-tier plans, which promise no rate. */
const DELETE_IDS = ['plan_starter', 'plan_advanced', 'plan_pro']

/* ------------------------------------------------------------------ */

const [admin] = await sql`select id, email from users where role = 'admin' order by created_at limit 1`
if (!admin) throw new Error('No admin user found to attribute these changes to.')

console.log(`Acting as: ${admin.email}`)
if (dryRun) console.log('\nDRY RUN — nothing will be written.\n')

/* --- Refuse to delete anything a contract points at ----------------- */

const blocked = await sql`
  select p.id, count(i.id)::int as rows
  from investment_plans p
  join investments i on i.plan_id = p.id
  where p.id = any(${DELETE_IDS})
  group by p.id`

if (blocked.length > 0) {
  console.error('\nREFUSING TO DELETE — these plans have live contracts against them:')
  for (const row of blocked) console.error(`  ${row.id}: ${row.rows} investment row(s)`)
  console.error('\nUnpublish them instead; a plan with history must not be removed.')
  process.exit(1)
}

/* --- Publish --------------------------------------------------------- */

console.log('\nPublishing:')
let published = 0

for (const id of PUBLISH_IDS) {
  const [plan] = await sql`
    select id, name, published, fixed_rate_percent, duration_days
    from investment_plans where id = ${id}`

  if (!plan) {
    console.log(`  MISSING  ${id} — run scripts/seed-plans.mts first`)
    continue
  }
  if (plan.published) {
    console.log(`  ALREADY  ${plan.name}`)
    continue
  }
  if (dryRun) {
    console.log(`  WOULD    ${plan.name} (${plan.fixed_rate_percent}% over ${plan.duration_days}d)`)
    published++
    continue
  }

  await sql`
    update investment_plans
    set yield_source = ${YIELD_SOURCE},
        published = true,
        updated_at = now(),
        updated_by = ${admin.id}
    where id = ${id}`

  await sql`
    insert into audit_log (actor_id, actor_role, action, target_type, target_id, metadata)
    values (
      ${admin.id}, 'admin', 'plan.updated', 'investment_plan', ${id},
      ${JSON.stringify({
        name: plan.name,
        published: true,
        yieldSourceSet: true,
        source: 'scripts/publish-plans.mts',
      })}
    )`

  console.log(`  PUBLISHED ${plan.name}`)
  published++
}

/* --- Delete the originals -------------------------------------------- */

console.log('\nRemoving original service-tier plans:')
let deleted = 0

for (const id of DELETE_IDS) {
  const [plan] = await sql`select id, name from investment_plans where id = ${id}`
  if (!plan) {
    console.log(`  GONE     ${id} (already removed)`)
    continue
  }
  if (dryRun) {
    console.log(`  WOULD    delete ${plan.name} (${id})`)
    deleted++
    continue
  }

  await sql`delete from investment_plans where id = ${id}`
  await sql`
    insert into audit_log (actor_id, actor_role, action, target_type, target_id, metadata)
    values (
      ${admin.id}, 'admin', 'plan.deleted', 'investment_plan', ${id},
      ${JSON.stringify({ name: plan.name, source: 'scripts/publish-plans.mts' })}
    )`

  console.log(`  DELETED  ${plan.name}`)
  deleted++
}

console.log(
  `\n${dryRun ? 'Would publish' : 'Published'} ${published} plan(s); ` +
    `${dryRun ? 'would delete' : 'deleted'} ${deleted}.`,
)

process.exit(0)
