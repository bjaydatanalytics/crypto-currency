import 'server-only'
import { brand } from '@/lib/config'

/**
 * Email templates.
 *
 * Every message ships both HTML and plain text — some clients render only text,
 * and a security email that arrives blank is worse than useless.
 *
 * Deliberate choices:
 * - Inline styles only. Gmail and Outlook strip <style> blocks.
 * - Table layout. Flexbox and grid are unreliable across mail clients.
 * - The link appears as visible text as well as an anchor, so a recipient can
 *   read the destination before clicking — and can still act if the button
 *   fails to render.
 * - No tracking pixels or remote images.
 */

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

const COLORS = {
  bg: '#f5f6f4',
  card: '#ffffff',
  ink: '#111511',
  muted: '#5c625c',
  accent: '#3d6b00',
  border: '#e2e5e0',
}

function layout(options: {
  heading: string
  body: string
  cta?: { label: string; url: string }
  footnote?: string
}) {
  const { heading, body, cta, footnote } = options

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};padding:32px 16px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:12px;">
    <tr><td style="padding:28px 32px 0;">
      <span style="font:700 15px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;letter-spacing:.18em;color:${COLORS.ink};">${escapeHtml(brand.wordmark)}</span>
    </td></tr>
    <tr><td style="padding:24px 32px 0;">
      <h1 style="margin:0;font:600 21px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:${COLORS.ink};">${escapeHtml(heading)}</h1>
    </td></tr>
    <tr><td style="padding:14px 32px 0;font:400 15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:${COLORS.muted};">
      ${body}
    </td></tr>
    ${
      cta
        ? `<tr><td style="padding:26px 32px 0;">
      <a href="${escapeAttr(cta.url)}" style="display:inline-block;background:${COLORS.accent};color:#ffffff;text-decoration:none;font:600 15px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;padding:14px 26px;border-radius:8px;">${escapeHtml(cta.label)}</a>
    </td></tr>
    <tr><td style="padding:18px 32px 0;font:400 13px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:${COLORS.muted};">
      Or copy this link into your browser:<br>
      <span style="word-break:break-all;color:${COLORS.accent};">${escapeHtml(cta.url)}</span>
    </td></tr>`
        : ''
    }
    ${
      footnote
        ? `<tr><td style="padding:24px 32px 0;">
      <div style="border-top:1px solid ${COLORS.border};padding-top:18px;font:400 13px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:${COLORS.muted};">${footnote}</div>
    </td></tr>`
        : ''
    }
    <tr><td style="padding:24px 32px 30px;">
      <div style="border-top:1px solid ${COLORS.border};padding-top:18px;font:400 12px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:${COLORS.muted};">
        ${escapeHtml(brand.name)} will never ask for your password, two-factor codes or recovery codes.
        We will never ask you to move funds to a &ldquo;safe&rdquo; address.
      </div>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const escapeAttr = escapeHtml

const SECURITY_FOOTER =
  `${brand.name} will never ask for your password, two-factor codes or recovery codes.\n` +
  `We will never ask you to move funds to a "safe" address.`

/* ------------------------------------------------------------------ */

export function verificationEmail(link: string): RenderedEmail {
  return {
    subject: 'Confirm your email address',
    html: layout({
      heading: 'Confirm your email address',
      body: `<p style="margin:0;">Confirm this address to finish setting up your ${escapeHtml(brand.name)} account.</p>`,
      cta: { label: 'Confirm email address', url: link },
      footnote:
        'This link expires in 24 hours and can be used once. If you did not create an account, ignore this message — no account will be activated.',
    }),
    text: [
      'Confirm your email address',
      '',
      `Confirm this address to finish setting up your ${brand.name} account:`,
      link,
      '',
      'This link expires in 24 hours and can be used once.',
      'If you did not create an account, ignore this message.',
      '',
      SECURITY_FOOTER,
    ].join('\n'),
  }
}

export function passwordResetEmail(link: string): RenderedEmail {
  return {
    subject: 'Reset your password',
    html: layout({
      heading: 'Reset your password',
      body: '<p style="margin:0;">Use the button below to set a new password. Every device signed in to your account will be signed out.</p>',
      cta: { label: 'Set a new password', url: link },
      footnote:
        'This link expires in 1 hour and can be used once. If you did not request a reset, ignore this message — your password has not changed.',
    }),
    text: [
      'Reset your password',
      '',
      'Use this link to set a new password:',
      link,
      '',
      'Every device signed in to your account will be signed out.',
      'This link expires in 1 hour and can be used once.',
      'If you did not request this, ignore it — your password has not changed.',
      '',
      SECURITY_FOOTER,
    ].join('\n'),
  }
}

/**
 * Security notifications.
 *
 * Sent after the change has already happened. This is frequently how someone
 * first discovers their account was taken over, so it goes out on success —
 * not only on failure — and always tells them what to do next.
 */
export function securityAlertEmail(event: string, occurredAt: Date): RenderedEmail {
  const when = occurredAt.toUTCString()
  return {
    subject: 'Security change on your account',
    html: layout({
      heading: 'Security change on your account',
      body:
        `<p style="margin:0 0 10px;"><strong style="color:${COLORS.ink};">${escapeHtml(event)}</strong></p>` +
        `<p style="margin:0;">Recorded at ${escapeHtml(when)}.</p>`,
      footnote:
        'If this was not you, reset your password immediately, sign out all other devices from your security settings, and contact support.',
    }),
    text: [
      'Security change on your account',
      '',
      event,
      `Recorded at ${when}.`,
      '',
      'If this was not you: reset your password immediately, sign out all other',
      'devices from your security settings, and contact support.',
      '',
      SECURITY_FOOTER,
    ].join('\n'),
  }
}

/**
 * Deposit credited, or withdrawal paid.
 *
 * Sent after the ledger has already moved, so it reports a fact rather than an
 * intention. The amount and asset are stated exactly as recorded — never
 * rounded for readability, because a customer reconciling this against their
 * own records needs the figure that was actually posted.
 *
 * Carries no link and asks for nothing. A message about money that contains a
 * call to action is the shape every phishing attempt takes, and training
 * customers to click one is a disservice.
 */
export function transactionEmail(options: {
  kind: 'deposit' | 'withdrawal'
  amount: string
  asset: string
  network?: string | null
  txHash?: string | null
  occurredAt: Date
}): RenderedEmail {
  const { kind, amount, asset, network, txHash, occurredAt } = options
  const credited = kind === 'deposit'
  const heading = credited ? 'Deposit credited' : 'Withdrawal sent'
  const line = credited
    ? `${amount} ${asset} has been credited to your account.`
    : `${amount} ${asset} has been sent from your account.`
  const when = occurredAt.toUTCString()

  const details: Array<[string, string]> = [['Recorded at', when]]
  if (network) details.push(['Network', network])
  if (txHash) details.push(['Transaction', txHash])

  return {
    subject: heading,
    html: layout({
      heading,
      body:
        `<p style="margin:0 0 12px;"><strong style="color:${COLORS.ink};">${escapeHtml(line)}</strong></p>` +
        details
          .map(
            ([label, value]) =>
              `<p style="margin:0 0 6px;color:${COLORS.muted};">${escapeHtml(label)}: <span style="color:${COLORS.ink};word-break:break-all;">${escapeHtml(value)}</span></p>`,
          )
          .join(''),
      footnote:
        'If you do not recognise this, contact support immediately. You can turn these notifications off in your profile settings — security alerts will still be sent.',
    }),
    text: [
      heading,
      '',
      line,
      ...details.map(([label, value]) => `${label}: ${value}`),
      '',
      'If you do not recognise this, contact support immediately.',
      '',
      SECURITY_FOOTER,
    ].join('\n'),
  }
}

/**
 * Support has replied to a ticket.
 *
 * Carries the subject and nothing else — not the reply body. A support thread
 * can contain account details, verification questions or transaction figures,
 * and email is the least controlled channel it could travel over. The customer
 * signs in to read it.
 *
 * No link either, for the same reason every other notification here has none:
 * a message about your account containing a button to click is the shape of
 * every phishing attempt, and training people to click one is a disservice.
 */
export function supportReplyEmail(subject: string, occurredAt: Date): RenderedEmail {
  const when = occurredAt.toUTCString()
  return {
    subject: 'Support replied to your ticket',
    html: layout({
      heading: 'Support replied to your ticket',
      body:
        `<p style="margin:0 0 10px;">There is a new reply on your ticket <strong style="color:${COLORS.ink};">${escapeHtml(subject)}</strong>.</p>` +
        `<p style="margin:0;color:${COLORS.muted};">Sign in and open Support to read it. Replied at ${escapeHtml(when)}.</p>`,
      footnote:
        'The reply itself is not included in this email — support threads can contain account details, so you read them signed in. We will never ask you for your password, two-factor codes or recovery codes.',
    }),
    text: [
      'Support replied to your ticket',
      '',
      `There is a new reply on your ticket: ${subject}`,
      `Replied at ${when}.`,
      '',
      'Sign in and open Support to read it. The reply is not included here',
      'because support threads can contain account details.',
      '',
      SECURITY_FOOTER,
    ].join('\n'),
  }
}
