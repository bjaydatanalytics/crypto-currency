/**
 * Replaces the production plan catalogue with the development one.
 *
 *   npx tsx scripts/sync-plans-to-prod.mts --dry-run
 *   npx tsx scripts/sync-plans-to-prod.mts --confirm
 *
 * Production's plans are DELETED and dev's are inserted in their place, so the
 * two catalogues match exactly — same ids, terms, yield sources and published
 * flags. This is a replace, not a merge: the ids differ between the two
 * databases, so copying without deleting would leave production holding both
 * sets and showing three plans twice under the same names.
 *
 * Deletion is refused if any `investments` row references a plan being
 * removed. `investments.plan_id` is declared `onDelete: 'restrict'`, so the
 * database would reject it anyway — the check here exists to fail with a
 * sentence rather than a constraint violation. A plan somebody has a live
 * contract against must be unpublished, never deleted.
 *
 * Everything runs inside one transaction. A half-applied catalogue — old plans
 * gone, new ones not yet written — is a storefront with nothing in it.
 */

import { config } from 'dotenv'

config({ path: '.env.local' })

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const confirmed = args.includes('--confirm')

if (!dryRun && !confirmed) {
  throw new Error('Pass --dry-run to preview, or --confirm to write to production.')
}

const devUrl = process.env.DATABASE_URL
const prodUrl = process.env.PROD_DATABASE_URL
if (!devUrl || !prodUrl) throw new Error('DATABASE_URL and PROD_DATABASE_URL must both be set.')
if (devUrl === prodUrl) throw new Error('Dev and prod URLs are identical — refusing to run.')

const { neon } = await import('@neondatabase/serverless')
const dev = neon(devUrl)
const prod = neon(prodUrl)

/* --- read both sides ------------------------------------------------- */

const source = await dev`select * from investment_plans order by display_order, id`
const target = await prod`select id, name from investment_plans order by display_order, id`

console.log(`dev plans  : ${source.length}`)
console.log(`prod plans : ${target.length}`)

/* --- refuse to delete anything with contracts against it ------------- */

const targetIds = (target as any[]).map((r) => r.id)
const held =
  targetIds.length === 0
    ? []
    : await prod`
        select plan_id, count(*)::int n from investments
        where plan_id = any(${targetIds}) group by plan_id`

if (held.length > 0) {
  console.error('\nREFUSING — production plans have live contracts against them:')
  for (const row of held as any[]) console.error(`  ${row.plan_id}: ${row.n} investment(s)`)
  console.error('\nUnpublish those instead. A plan with history must not be deleted.')
  process.exit(1)
}

/* --- show the plan ---------------------------------------------------- */

console.log('\nWould delete from production:')
for (const row of target as any[]) console.log(`  - ${row.id} (${row.name})`)

console.log('\nWould insert into production:')
for (const p of source as any[]) {
  const state = p.published ? 'live ' : 'draft'
  console.log(
    `  + ${String(p.id).padEnd(22)} ${String(p.name).padEnd(15)} ${p.category.padEnd(11)} ${state} ` +
      `rate=${String(p.fixed_rate_percent).padStart(8)} ${String(p.duration_days).padStart(4)}d`,
  )
}

if (dryRun) {
  console.log('\nDRY RUN — nothing written.')
  process.exit(0)
}

/* --- apply ------------------------------------------------------------ */

const [admin] = await prod`select id from users where role='admin' order by created_at limit 1`
if (!admin) throw new Error('No admin user in production to attribute this to.')

const statements = [
  prod`delete from investment_plans`,
  ...(source as any[]).map(
    (p) => prod`
      insert into investment_plans (
        id, tier, category, name, summary,
        minimum_amount, maximum_amount, fee_percent, duration_days, currency,
        features, risk_disclosure,
        fixed_rate_percent, rate_basis, yield_source,
        popular, published, display_order, updated_by
      ) values (
        ${p.id}, ${p.tier}, ${p.category}, ${p.name}, ${p.summary},
        ${p.minimum_amount}, ${p.maximum_amount}, ${p.fee_percent}, ${p.duration_days}, ${p.currency},
        ${JSON.stringify(p.features ?? [])}, ${p.risk_disclosure},
        ${p.fixed_rate_percent}, ${p.rate_basis}, ${p.yield_source},
        ${p.popular}, ${p.published}, ${p.display_order}, ${admin.id}
      )`,
  ),
  prod`
    insert into audit_log (actor_id, actor_role, action, target_type, metadata)
    values (${admin.id}, 'admin', 'plan.updated', 'investment_plan',
      ${JSON.stringify({
        change: 'production catalogue replaced with development catalogue',
        removed: targetIds,
        inserted: (source as any[]).map((p) => p.id),
        source: 'scripts/sync-plans-to-prod.mts',
      })})`,
]

// All or nothing: a partially replaced catalogue is worse than either state.
await prod.transaction(statements)

/* --- verify ----------------------------------------------------------- */

const after = await prod`
  select id, name, category, published, fixed_rate_percent rate, duration_days days,
         coalesce(length(yield_source),0) ys
  from investment_plans order by display_order, id`

console.log('\nProduction now holds:')
for (const p of after as any[]) {
  console.log(
    `  ${String(p.id).padEnd(22)} ${String(p.name).padEnd(15)} ${p.category.padEnd(11)} ` +
      `${p.published ? 'live ' : 'draft'} rate=${String(p.rate).padStart(8)} ${String(p.days).padStart(4)}d  ys=${p.ys}`,
  )
}

const live = (after as any[]).filter((p) => p.published).length
console.log(`\nReplaced. ${after.length} plans, ${live} published.`)
process.exit(0)
