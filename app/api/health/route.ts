import { count, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { deposits, platformDepositAddresses } from '@/db/ledger-schema'
import { ok, withErrorHandling } from '@/lib/server/api'
import { capabilities } from '@/lib/server/env'
import { verifyLedgerIntegrity } from '@/lib/server/ledger'
import { activeTransport, verifyMailTransport } from '@/lib/server/mailer'

/**
 * Operational health.
 *
 * Reports what is genuinely wired up, so a misconfiguration is found by
 * monitoring rather than by a customer mid-signup. Deliberately unauthenticated
 * but leaks nothing: booleans and counts only, never keys, hosts or addresses.
 *
 * `ledger.balanced` is the one to alert on. A non-empty imbalance means entries
 * were written outside `postTransaction`, and the books no longer add up.
 */
export const GET = withErrorHandling(async () => {
  const checks: Record<string, unknown> = {}

  try {
    await db.execute(sql`select 1`)
    checks.database = { ok: true }
  } catch (error) {
    checks.database = {
      ok: false,
      error: error instanceof Error ? error.message : 'unreachable',
    }
  }

  const mail = await verifyMailTransport()
  checks.email = {
    ok: mail.ok,
    transport: activeTransport(),
    // Without this, verification and reset emails silently never arrive.
    error: mail.error,
  }

  /**
   * Deposit readiness.
   *
   * There is no custody provider to ping, so the meaningful question is
   * operational: are there addresses to assign, and is anything sitting
   * uncredited? `pendingDeposits` is the one to watch — in a manual flow it
   * only grows when nobody is reviewing, and every entry is a customer whose
   * money has arrived but whose balance still reads zero.
   */
  try {
    const [[addressCount], [pending]] = await Promise.all([
      db
        .select({ value: count() })
        .from(platformDepositAddresses)
        .where(eq(platformDepositAddresses.status, 'active')),
      db
        .select({ value: count() })
        .from(deposits)
        .where(inArray(deposits.status, ['detected', 'confirming'])),
    ])

    checks.deposits = {
      model: 'managed',
      activeAddresses: addressCount?.value ?? 0,
      pendingDeposits: pending?.value ?? 0,
      note:
        (addressCount?.value ?? 0) === 0
          ? 'No receiving addresses are recorded, so no user can deposit.'
          : undefined,
    }
  } catch {
    checks.deposits = { model: 'managed', error: 'Could not read deposit state.' }
  }

  checks.marketData = { configured: capabilities.marketData }

  try {
    const imbalances = await verifyLedgerIntegrity()
    checks.ledger = {
      balanced: imbalances.length === 0,
      imbalances: imbalances.length > 0 ? imbalances : undefined,
    }
  } catch {
    checks.ledger = { balanced: null, error: 'Could not verify.' }
  }

  const healthy =
    (checks.database as { ok: boolean }).ok &&
    (checks.ledger as { balanced: boolean | null }).balanced !== false

  return ok({ status: healthy ? 'ok' : 'degraded', checks }, { status: healthy ? 200 : 503 })
})
