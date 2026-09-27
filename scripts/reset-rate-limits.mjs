/**
 * Clears rate-limit counters.
 *
 * Development convenience: re-running a signup or login flow legitimately trips
 * the limiter, and waiting out the window mid-debug is how people end up
 * disabling rate limiting altogether — which is how it ends up disabled in
 * production too.
 *
 * Run with:  npm run db:reset-limits
 *
 * Refuses to run against NODE_ENV=production. Clearing counters there would
 * hand an in-progress credential-stuffing attack a fresh allowance.
 */

import { config } from 'dotenv'
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

config({ path: '.env.local' })

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to clear rate limits in production.')
  process.exit(1)
}

if (typeof globalThis.WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const pool = new Pool({ connectionString })

try {
  const { rowCount } = await pool.query('delete from rate_limits')
  console.log(`Cleared ${rowCount} rate-limit row(s).`)

  // Account lockouts are a separate mechanism from the IP/email counters, and
  // a developer hitting one needs it cleared too.
  const unlocked = await pool.query(
    `update users set failed_login_count = 0, locked_until = null
     where failed_login_count > 0 or locked_until is not null
     returning email`,
  )
  if (unlocked.rowCount) {
    console.log(`Unlocked ${unlocked.rowCount} account(s): ${unlocked.rows.map((r) => r.email).join(', ')}`)
  }
} finally {
  await pool.end()
}
