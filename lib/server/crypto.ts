import 'server-only'
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2'
import { env } from './env'

/* ------------------------------------------------------------------ */
/* Passwords                                                           */
/* ------------------------------------------------------------------ */

/**
 * Argon2id parameters.
 *
 * 19 MiB / 2 iterations / 1 lane is the OWASP baseline. Memory cost is what
 * actually defeats GPU cracking, so raise `memoryCost` before `timeCost` if you
 * tune this. Changing these does not invalidate existing hashes — the encoded
 * hash carries its own parameters, so old passwords keep verifying.
 */
const ARGON_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const

export function hashPassword(password: string): Promise<string> {
  return argonHash(password, ARGON_OPTIONS)
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argonVerify(hash, password)
  } catch {
    // Malformed hash in the row — treat as a failed login, never as a pass.
    return false
  }
}

/**
 * Burns roughly the same time as a real verification.
 *
 * Called when the email doesn't exist, so that response timing doesn't reveal
 * which addresses are registered.
 */
export async function fakePasswordVerify(): Promise<void> {
  await argonHash('timing-equalisation-only', ARGON_OPTIONS)
}

/* ------------------------------------------------------------------ */
/* Opaque tokens                                                       */
/* ------------------------------------------------------------------ */

/**
 * Session and one-time tokens.
 *
 * 32 random bytes, base64url. Hashed with SHA-256 for storage: these are
 * high-entropy random values, not passwords, so a fast hash is correct here —
 * there is nothing to brute-force. Argon2 would only add latency to every
 * request.
 */
export function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Constant-time comparison, for anything an attacker can submit repeatedly. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/** Human-enterable recovery codes, e.g. "4F7K-9QX2". */
export function generateRecoveryCode(): string {
  // Excludes I, O, 0, 1 — they are misread when copied off a screen.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(8)
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length])
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`
}

/* ------------------------------------------------------------------ */
/* Encryption at rest                                                  */
/* ------------------------------------------------------------------ */

/**
 * AES-256-GCM for TOTP secrets.
 *
 * A TOTP secret is a live credential: anyone holding it can generate valid
 * second factors forever. It cannot be hashed (the server must reproduce the
 * code), so it is encrypted, and a database dump alone is not enough to bypass
 * 2FA — the attacker also needs ENCRYPTION_KEY from the environment.
 */
function encryptionKey(): Buffer {
  const key = Buffer.from(env.ENCRYPTION_KEY, 'base64')
  if (key.length === 32) return key
  // Accept a non-base64 passphrase by deriving a fixed-length key from it.
  return createHash('sha256').update(env.ENCRYPTION_KEY).digest()
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // iv.tag.ciphertext — all three are needed to decrypt and verify.
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`
}

export function decryptSecret(payload: string): string | null {
  try {
    const [ivPart, tagPart, dataPart] = payload.split('.')
    if (!ivPart || !tagPart || !dataPart) return null

    const decipher = createDecipheriv(
      'aes-256-gcm',
      encryptionKey(),
      Buffer.from(ivPart, 'base64'),
    )
    decipher.setAuthTag(Buffer.from(tagPart, 'base64'))

    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, 'base64')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    // Wrong key or tampered ciphertext. Fail closed.
    return null
  }
}
