/**
 * Marks every existing account as email-verified.
 *
 *   npx tsx scripts/backfill-email-verified.mts --dry-run
 *   npx tsx scripts/backfill-email-verified.mts
 *
 * Email verification has been removed from the product: registration now
 * stamps `emailVerifiedAt` on insert. Accounts created before that change can
 * still be sitting unverified, and since nothing can clear that state any more
 * — the confirmation route and its email are gone — they would be stuck with
 * features silently refusing them forever.
 *
 * `emailVerifiedAt` is left in place rather than dropped. It is a historical
 * record of who actually confirmed an address and when, and the password-reset
 * flow still sets it. Backfilled rows are stamped with the current time, so
 * they are not claimed to have confirmed at some earlier date they did not.
 */

import { config } from 'dotenv'

config({ path: '.env.local' })

const { neon } = await import('@neondatabase/serverless')

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is not set — check .env.local')

const sql = neon(databaseUrl)
const dryRun = process.argv.includes('--dry-run')

const pending = await sql`
  select id, email, created_at from users
  where email_verified_at is null
  order by created_at`

if (pending.length === 0) {
  console.log('Every account is already marked verified. Nothing to do.')
  process.exit(0)
}

console.log(`${pending.length} account(s) with no verification timestamp:`)
for (const row of pending) console.log(`  ${row.email}`)

if (dryRun) {
  console.log('\nDRY RUN — nothing written.')
  process.exit(0)
}

const updated = await sql`
  update users set email_verified_at = now(), updated_at = now()
  where email_verified_at is null
  returning id, email`

for (const row of updated) {
  await sql`
    insert into audit_log (actor_id, actor_role, action, target_type, target_id, metadata)
    values (
      ${row.id}, 'admin', 'user.updated', 'user', ${row.id},
      ${JSON.stringify({
        change: 'email_verified_at backfilled',
        reason: 'email verification removed from the product',
        source: 'scripts/backfill-email-verified.mts',
      })}
    )`
}

console.log(`\nMarked ${updated.length} account(s) verified.`)
process.exit(0)
