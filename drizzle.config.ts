import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

// drizzle-kit runs outside Next.js, so .env.local is not loaded for it.
config({ path: '.env.local' })

export default defineConfig({
  // Split by concern to keep each file readable: core identity, the custodial
  // ledger, and the non-custodial wallet model.
  schema: ['./db/schema.ts', './db/ledger-schema.ts', './db/wallet-schema.ts'],
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
})
