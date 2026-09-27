import 'server-only'
import { Pool, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import ws from 'ws'
import { env } from '@/lib/server/env'
import * as coreSchema from './schema'
import * as ledgerSchema from './ledger-schema'
import * as walletSchema from './wallet-schema'

/** Drizzle needs one combined schema object for relational queries. */
const schema = { ...coreSchema, ...ledgerSchema, ...walletSchema }

/**
 * Database client.
 *
 * Uses Neon's WebSocket pool rather than the HTTP driver because the HTTP
 * driver cannot run multi-statement transactions, and several flows here must
 * be atomic — rotating a session while revoking the old one, or consuming a
 * one-time token while marking the email verified.
 */

// Node has no global WebSocket before v22; supply one for the driver.
if (typeof globalThis.WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws
}

/**
 * Cached across hot reloads. Without this, every dev-server recompile opens a
 * fresh pool and Neon starts refusing connections.
 */
const globalForDb = globalThis as unknown as {
  __pool?: Pool
  __db?: ReturnType<typeof drizzle<typeof schema>>
}

function getDb() {
  if (globalForDb.__db) return globalForDb.__db

  const pool =
    globalForDb.__pool ??
    new Pool({
      connectionString: env.DATABASE_URL,
      // Serverless invocations are short-lived; a large pool just exhausts Neon.
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })

  const instance = drizzle(pool, { schema })

  if (env.NODE_ENV !== 'production') {
    globalForDb.__pool = pool
    globalForDb.__db = instance
  }
  return instance
}

/**
 * Connects on first query, not at import.
 *
 * `next build` imports every route module; opening a pool at module scope would
 * make a build require a reachable database. This defers both the connection
 * and the env validation behind it to the first actual query.
 */
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, property: string | symbol) {
    const instance = getDb()
    const value = instance[property as keyof typeof instance]
    return typeof value === 'function' ? value.bind(instance) : value
  },
})

export { schema }
