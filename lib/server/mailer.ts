import 'server-only'
import nodemailer, { type Transporter } from 'nodemailer'
import { env } from './env'
import {
  passwordResetEmail,
  securityAlertEmail,
  supportReplyEmail,
  transactionEmail,
  verificationEmail,
  type RenderedEmail,
} from './email-templates'

/**
 * Transactional email.
 *
 * Two working transports, selected by whichever is configured:
 *
 *   RESEND_API_KEY  → Resend's HTTP API (no TCP, works on any runtime)
 *   SMTP_URL        → any SMTP provider via nodemailer (SES, Postmark, Mailgun…)
 *
 * Resend wins when both are set, because HTTP survives environments that block
 * outbound SMTP ports — a common and confusing failure on managed hosts.
 *
 * With neither configured, `send` returns `{ sent: false }` and callers say so.
 * It never claims a message was delivered that wasn't: telling someone to check
 * their inbox for an email that was never dispatched leaves them waiting
 * forever on a link that does not exist.
 */

export interface MailResult {
  sent: boolean
  /** Provider message id, when one came back. */
  id?: string
  /** Why delivery failed or was skipped. */
  reason?: string
}

export type MailTransport = 'resend' | 'smtp' | 'none'

export function activeTransport(): MailTransport {
  if (env.RESEND_API_KEY) return 'resend'
  if (env.SMTP_URL) return 'smtp'
  return 'none'
}

/** Cached across invocations — building a pool per email exhausts connections. */
const globalForMail = globalThis as unknown as { __smtp?: Transporter }

function smtpTransport(): Transporter {
  if (globalForMail.__smtp) return globalForMail.__smtp

  /**
   * Built from the connection URL alone.
   *
   * No connection pooling: serverless instances are frozen between invocations,
   * so a pooled socket is usually dead by the next request and fails in ways
   * that look like provider outages. Transactional volume here (signup,
   * verification, reset) does not justify the risk.
   *
   * Tune via URL query parameters if your provider needs it, e.g.
   *   smtp://user:pass@host:587?pool=true&connectionTimeout=10000
   */
  const transport = nodemailer.createTransport(env.SMTP_URL!)

  globalForMail.__smtp = transport
  return transport
}

async function sendViaResend(to: string, email: RenderedEmail): Promise<MailResult> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [to],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Resend responded ${response.status}: ${detail.slice(0, 300)}`)
  }

  const payload = (await response.json()) as { id?: string }
  return { sent: true, id: payload.id }
}

async function sendViaSmtp(to: string, email: RenderedEmail): Promise<MailResult> {
  const info = await smtpTransport().sendMail({
    from: env.MAIL_FROM,
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  })
  return { sent: true, id: info.messageId }
}

async function send(to: string, email: RenderedEmail): Promise<MailResult> {
  const transport = activeTransport()

  if (transport === 'none') {
    // Development aid so the flows can be exercised without a provider.
    // Guarded: a token in a production log is a credential leak.
    if (env.NODE_ENV !== 'production') {
      console.warn(
        `\n[mailer] No transport configured — message NOT sent.\n` +
          `  To:      ${to}\n  Subject: ${email.subject}\n` +
          `${email.text.replace(/^/gm, '  ')}\n`,
      )
    } else {
      console.error(
        '[mailer] No transport configured. Transactional email is NOT being delivered. ' +
          'Set RESEND_API_KEY or SMTP_URL.',
      )
    }
    return { sent: false, reason: 'no_transport_configured' }
  }

  if (!env.MAIL_FROM) {
    console.error('[mailer] MAIL_FROM is required when a transport is configured.')
    return { sent: false, reason: 'missing_from_address' }
  }

  try {
    return transport === 'resend' ? await sendViaResend(to, email) : await sendViaSmtp(to, email)
  } catch (error) {
    /**
     * Never rethrow.
     *
     * A provider outage must not fail the surrounding request — the account was
     * still created, the reset token still issued. The caller is told delivery
     * failed and surfaces that, so the user can retry rather than being shown a
     * generic 500 for an action that actually succeeded.
     */
    console.error('[mailer] delivery failed:', error)
    return {
      sent: false,
      reason: error instanceof Error ? error.message : 'delivery_failed',
    }
  }
}

/* ------------------------------------------------------------------ */
/* Public API — unchanged call sites                                   */
/* ------------------------------------------------------------------ */

export function sendVerificationEmail(to: string, token: string): Promise<MailResult> {
  const link = `${env.APP_URL}/verify-email?token=${encodeURIComponent(token)}`
  return send(to, verificationEmail(link))
}

export function sendPasswordResetEmail(to: string, token: string): Promise<MailResult> {
  const link = `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`
  return send(to, passwordResetEmail(link))
}

/**
 * Security alerts are never gated on a preference.
 *
 * There is no column to disable these, by design. They are how someone learns
 * their account was taken over, and an attacker holding a live session would
 * switch them off first.
 */
export function sendSecurityAlert(to: string, event: string): Promise<MailResult> {
  return send(to, securityAlertEmail(event, new Date()))
}

/**
 * Tells a customer their money moved. Respects their preference.
 *
 * Returns `{ skipped: true }` when they have turned these off — distinct from
 * a send that failed, so a caller logging the result does not report a
 * delivery problem where there is none.
 *
 * Never throws. A notification failing must not roll back the ledger entry it
 * describes: the money moved, and that fact is not contingent on an email.
 */
export async function sendTransactionNotice(options: {
  userId: string
  to: string
  kind: 'deposit' | 'withdrawal'
  amount: string
  asset: string
  network?: string | null
  txHash?: string | null
}): Promise<MailResult | { ok: false; skipped: true }> {
  try {
    const { wantsTransactionEmails } = await import('./preferences')
    if (!(await wantsTransactionEmails(options.userId))) {
      return { ok: false, skipped: true }
    }

    return await send(
      options.to,
      transactionEmail({
        kind: options.kind,
        amount: options.amount,
        asset: options.asset,
        network: options.network,
        txHash: options.txHash,
        occurredAt: new Date(),
      }),
    )
  } catch (error) {
    console.error('[mail] transaction notice failed', error)
    return { ok: false, skipped: true }
  }
}

/**
 * Tells a customer support has replied.
 *
 * Not gated on a preference: they opened the conversation and are waiting on an
 * answer, so this is a direct response to something they asked for rather than
 * a notification they might not want. Never throws — a failed email must not
 * roll back a reply that was genuinely posted.
 */
export async function sendSupportReply(to: string, subject: string): Promise<MailResult> {
  try {
    return await send(to, supportReplyEmail(subject, new Date()))
  } catch (error) {
    console.error('[mail] support reply notice failed', error)
    return { sent: false, reason: 'notice_failed' }
  }
}

/**
 * Verifies the transport can actually connect.
 *
 * Used by the health endpoint so a broken mail configuration is discovered
 * before a user hits it during signup, not after.
 */
export async function verifyMailTransport(): Promise<{ ok: boolean; transport: MailTransport; error?: string }> {
  const transport = activeTransport()
  if (transport === 'none') return { ok: false, transport, error: 'No transport configured.' }

  try {
    if (transport === 'smtp') {
      await smtpTransport().verify()
    } else {
      // Resend has no verify endpoint; a key-shaped check is the best available.
      if (!env.RESEND_API_KEY?.startsWith('re_')) {
        return { ok: false, transport, error: 'RESEND_API_KEY does not look valid.' }
      }
    }
    return { ok: true, transport }
  } catch (error) {
    return {
      ok: false,
      transport,
      error: error instanceof Error ? error.message : 'Verification failed.',
    }
  }
}
