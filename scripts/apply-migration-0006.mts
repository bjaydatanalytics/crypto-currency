/**
 * Applies migration 0006 (plan_category) to a chosen database.
 *
 *   npx tsx scripts/apply-migration-0006.mts --target dev
 *   npx tsx scripts/apply-migration-0006.mts --target prod --confirm
 *
 * Why this exists rather than `drizzle-kit migrate`: this project's databases
 * were created with `db:push`, so `drizzle.__drizzle_migrations` is empty and
 * `migrate` would try to replay every migration from 0000 against a schema
 * that already has those objects. Nothing applies migrations on deploy either
 * — `vercel.json` defines only the cron, and `build` is plain `next build`.
 *
 * Both statements are written idempotently (`IF NOT EXISTS`, and the enum
 * guarded by an exception handler), so a later `db:push` or `migrate` cannot
 * collide with them and re-running this is harmless.
 *
 * `--target prod` additionally requires `--confirm`, because the production
 * database has real customers behind it and a mistyped flag should not be
 * enough to write to it.
 */

import { config } from 'dotenv'

config({ path: '.env.local' })

const args = process.argv.slice(2)
const target = args.includes('--target') ? args[args.indexOf('--target') + 1] : undefined
const confirmed = args.includes('--confirm')

if (target !== 'dev' && target !== 'prod') {
  throw new Error('Pass --target dev or --target prod')
}
if (target === 'prod' && !confirmed) {
  throw new Error('Refusing to write to production without --confirm')
}

const url = target === 'prod' ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL
if (!url) throw new Error(`No connection string for --target ${target}`)

const { neon } = await import('@neondatabase/serverless')
const sql = neon(url)

const [{ host }] = await sql`select current_setting('server_version') as host`
console.log(`target     : ${target}`)
console.log(`postgres   : ${host}`)

/* --- before ---------------------------------------------------------- */

const before = await sql`
  select column_name from information_schema.columns
  where table_name='investment_plans' and column_name='category'`
console.log(`category column present before: ${before.length > 0}`)

if (before.length > 0) {
  console.log('\nAlready applied. Nothing to do.')
  process.exit(0)
}

/* --- apply ----------------------------------------------------------- */

await sql`DO $$ BEGIN
  CREATE TYPE "public"."plan_category" AS ENUM('standard','retirement');
EXCEPTION WHEN duplicate_object THEN NULL; END $$`

await sql`ALTER TABLE "investment_plans"
  ADD COLUMN IF NOT EXISTS "category" "plan_category" DEFAULT 'standard' NOT NULL`

/* --- verify ---------------------------------------------------------- */

const after = await sql`
  select column_name, data_type, is_nullable, column_default
  from information_schema.columns
  where table_name='investment_plans' and column_name='category'`
console.log('category column after        :', JSON.stringify(after[0]))

const dist = await sql`select category, count(*)::int n from investment_plans group by category`
console.log('plans by category            :', JSON.stringify(dist))

console.log('\nApplied. Existing plans defaulted to "standard".')
process.exit(0)
