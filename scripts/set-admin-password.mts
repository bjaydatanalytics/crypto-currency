/**
 * Sets an admin's password to the value in `.env.admin.local`.
 *
 *   npx tsx scripts/set-admin-password.mts --dry-run
 *   npx tsx scripts/set-admin-password.mts
 *
 * Why this exists: `.env.admin.local` holds ADMIN_EMAIL and ADMIN_PASSWORD,
 * but **Next.js never loads a file with that name** — it reads `.env`,
 * `.env.local`, and the `.development`/`.production` variants, nothing else.
 * Nothing in the codebase reads those two variables either. Writing a password
 * there therefore changes nothing, which is why signing in fails.
 *
 * Credentials live in one place only: the `password_hash` column. This script
 * is what reconciles the file with that column, hashing through the same
 * argon2id parameters `lib/server/crypto.ts` uses so the login route verifies
 * it identically.
 *
 * It also clears the failed-attempt counter and the login rate-limit rows for
 * that address, since a run of wrong guesses is what prompted it.
 *
 * The password is never printed, and never written anywhere but the hash.
 */

import { readFileSync } from 'node:fs'
import { config } from 'dotenv'

config({ path: '.env.local' })

const dryRun = process.argv.includes('--dry-run')

/* --- read the intended credentials --------------------------------- */

let raw: string
try {
  raw = readFileSync('.env.admin.local', 'utf8')
} catch {
  throw new Error('.env.admin.local not found — create it with ADMIN_EMAIL and ADMIN_PASSWORD.')
}

const email = (raw.match(/^ADMIN_EMAIL\s*=\s*"?([^"\r\n]+)"?/m) ?? [])[1]?.trim().toLowerCase()
const password = (raw.match(/^ADMIN_PASSWORD\s*=\s*"?([^"\r\n]+)"?/m) ?? [])[1]

if (!email) throw new Error('ADMIN_EMAIL is missing from .env.admin.local')
if (!password) throw new Error('ADMIN_PASSWORD is missing from .env.admin.local')

/**
 * The login route enforces no minimum on an existing password, but a short
 * admin password is the weakest link in the whole platform — refuse it here
 * rather than quietly setting one.
 */
if (password.length < 12) {
  throw new Error(`ADMIN_PASSWORD is only ${password.length} characters. Use at least 12.`)
}

/* --- hash with the application's own parameters --------------------- */

const { hash, verify } = await import('@node-rs/argon2')

// Mirrors ARGON_OPTIONS in lib/server/crypto.ts. If that file changes, change
// this with it, or the login route will reject what this script writes.
const ARGON_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const

const { neon } = await import('@neondatabase/serverless')

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is not set — check .env.local')
const sql = neon(databaseUrl)

const [user] = await sql`
  select id, email, role, status, failed_login_count, password_hash
  from users where email = ${email}`

if (!user) throw new Error(`No account exists for ${email}.`)
if (user.role !== 'admin') {
  throw new Error(`${email} has role "${user.role}", not admin. Refusing to touch it.`)
}

const alreadyCorrect = await verify(user.password_hash, password)

console.log(`account        : ${user.email}`)
console.log(`role / status  : ${user.role} / ${user.status}`)
console.log(`failed logins  : ${user.failed_login_count}`)
console.log(`password already matches: ${alreadyCorrect}`)

if (alreadyCorrect) {
  console.log('\nThe stored hash already matches the file. Not rewriting it.')
} else if (dryRun) {
  console.log('\nDRY RUN — would set the hash to the password in .env.admin.local.')
} else {
  const passwordHash = await hash(password, ARGON_OPTIONS)

  await sql`
    update users
    set password_hash = ${passwordHash},
        password_changed_at = now(),
        failed_login_count = 0,
        locked_until = null,
        updated_at = now()
    where id = ${user.id}`

  await sql`
    insert into audit_log (actor_id, actor_role, action, target_type, target_id, metadata)
    values (
      ${user.id}, 'admin', 'user.password_changed', 'user', ${user.id},
      ${JSON.stringify({ reason: 'admin password reconciled with .env.admin.local', source: 'scripts/set-admin-password.mts' })}
    )`

  console.log('\nPassword updated, failed-attempt counter cleared, lock removed.')
}

/* --- clear the login rate limit for this address -------------------- */

if (!dryRun) {
  const cleared = await sql`
    delete from rate_limits
    where key = ${'login:email:' + email} or key like 'login:ip:%'
    returning key`
  if (cleared.length > 0) {
    console.log(`Cleared ${cleared.length} login rate-limit row(s).`)
  }
}

console.log('\nSign in at /login, then open /admin/plans.')
process.exit(0)
