import { fail, ok, withErrorHandling } from '@/lib/server/api'
import { safeEqual } from '@/lib/server/crypto'
import { env } from '@/lib/server/env'
import { matureDueInvestments } from '@/lib/server/investments'

/**
 * Scheduled maturity sweep.
 *
 * Contracts do not mature themselves. Without this running, every payout waits
 * for an operator to notice a date — which is how a customer discovers their
 * term ended a week ago and nothing happened.
 *
 * Schedule it at least daily. More often is harmless: a contract that is not
 * due is skipped, and one already matured cannot be matured twice.
 *
 * ### Why both GET and POST
 *
 * **Vercel Cron invokes jobs with GET.** So do several other schedulers. An
 * earlier version here accepted POST only and answered GET with 405, which
 * would have looked like a correctly configured cron that silently never paid
 * anybody — the worst possible failure for this particular job, because the
 * symptom appears weeks later as a customer complaint rather than an error.
 *
 * Both verbs run the same sweep behind the same authentication. The sweep is
 * idempotent (nothing due is skipped, nothing already paid is repaid), so
 * serving it over GET costs nothing.
 *
 * ### Authentication
 *
 * `CRON_SECRET` in an `Authorization: Bearer` header, compared in constant
 * time. Vercel sends exactly this header automatically when `CRON_SECRET` is
 * set as an environment variable, so no extra configuration is needed there.
 *
 * With no `CRON_SECRET` configured this refuses outright rather than running
 * unprotected — it moves money, and an open endpoint that triggers every
 * pending payout on demand is not acceptable even when each payout is
 * separately gated on its date and on treasury funds.
 */

async function runSweep(request: Request) {
  const secret = env.CRON_SECRET

  if (!secret) {
    return fail(
      'not_configured',
      'CRON_SECRET is not set, so this endpoint is disabled. Set it before scheduling maturities.',
      503,
    )
  }

  const header = request.headers.get('authorization') ?? ''
  const provided = header.startsWith('Bearer ') ? header.slice(7) : ''

  if (!provided || !safeEqual(provided, secret)) {
    return fail('unauthorized', 'Invalid or missing cron credentials.', 401)
  }

  const result = await matureDueInvestments()

  /**
   * A failed maturity is reported, not thrown.
   *
   * One underfunded contract must not stop the rest being paid, and the
   * shortfall has to come back as a list an operator can act on. The status is
   * 207 when anything failed so a monitor treats it as needing attention
   * rather than a clean run.
   */
  return ok(
    {
      matured: result.matured.length,
      failed: result.failed.length,
      failures: result.failed,
      message:
        result.failed.length === 0
          ? `${result.matured.length} contract(s) matured.`
          : `${result.matured.length} matured, ${result.failed.length} could not be paid — ` +
            'most likely an underfunded treasury. Fund it and re-run.',
    },
    { status: result.failed.length > 0 ? 207 : 200 },
  )
}

/** Vercel Cron and most scheduled-job runners use GET. */
export const GET = withErrorHandling(runSweep)

/** For manual invocation and schedulers that prefer POST. */
export const POST = withErrorHandling(runSweep)
