import 'server-only'
import { and, eq, isNull } from 'drizzle-orm'
import * as OTPAuth from 'otpauth'
import QRCode from 'qrcode'
import { db } from '@/db'
import { recoveryCodes } from '@/db/schema'
import { generateRecoveryCode, hashToken } from './crypto'

/**
 * TOTP second factor (RFC 6238).
 *
 * SHA-1 / 6 digits / 30-second period are the values every authenticator app
 * actually implements. Deviating here produces codes that Google Authenticator
 * and friends silently reject, so these are fixed rather than configurable.
 */

const ISSUER = 'Nexora'
const DIGITS = 6
const PERIOD = 30

/**
 * Accepts the adjacent step in each direction (±30s).
 *
 * Covers ordinary clock drift between the user's phone and the server. Widening
 * this further would meaningfully extend the window an intercepted code stays
 * valid.
 */
const WINDOW = 1

export function createTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32
}

function buildTotp(secret: string, accountLabel: string) {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: accountLabel,
    algorithm: 'SHA1',
    digits: DIGITS,
    period: PERIOD,
    secret: OTPAuth.Secret.fromBase32(secret),
  })
}

export function buildOtpAuthUrl(secret: string, accountLabel: string): string {
  return buildTotp(secret, accountLabel).toString()
}

/** QR as a data URI so the setup dialog needs no image hosting. */
export function renderQrCode(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, {
    width: 240,
    margin: 1,
    color: { dark: '#FFFFFF', light: '#0D100C00' },
  })
}

export function verifyTotp(secret: string, token: string, accountLabel: string): boolean {
  const normalised = token.replace(/\s/g, '')
  if (!/^\d{6}$/.test(normalised)) return false

  // Returns the matched time-step delta, or null when nothing matches.
  const delta = buildTotp(secret, accountLabel).validate({
    token: normalised,
    window: WINDOW,
  })
  return delta !== null
}

/* ------------------------------------------------------------------ */
/* Recovery codes                                                      */
/* ------------------------------------------------------------------ */

/**
 * Issues a fresh set of recovery codes, replacing any existing ones.
 *
 * Plaintext is returned exactly once, here, and only hashes are stored — so the
 * codes cannot be recovered from the database later. The UI must make clear
 * that this is the user's only chance to save them.
 */
export async function issueRecoveryCodes(userId: string, count = 10): Promise<string[]> {
  const codes = Array.from({ length: count }, () => generateRecoveryCode())

  await db.transaction(async (tx) => {
    await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId))
    await tx.insert(recoveryCodes).values(
      codes.map((code) => ({ userId, codeHash: hashToken(normaliseCode(code)) })),
    )
  })

  return codes
}

function normaliseCode(code: string): string {
  return code.replace(/[\s-]/g, '').toUpperCase()
}

/**
 * Consumes a recovery code.
 *
 * Single-use: the row is marked used inside the same statement that matches it,
 * so the same code cannot be replayed by two concurrent requests.
 */
export async function consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
  const normalised = normaliseCode(code)
  if (normalised.length < 6) return false

  const consumed = await db
    .update(recoveryCodes)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(recoveryCodes.userId, userId),
        eq(recoveryCodes.codeHash, hashToken(normalised)),
        isNull(recoveryCodes.usedAt),
      ),
    )
    .returning({ id: recoveryCodes.id })

  return consumed.length > 0
}

export async function countUnusedRecoveryCodes(userId: string): Promise<number> {
  const rows = await db
    .select({ id: recoveryCodes.id })
    .from(recoveryCodes)
    .where(and(eq(recoveryCodes.userId, userId), isNull(recoveryCodes.usedAt)))
  return rows.length
}
