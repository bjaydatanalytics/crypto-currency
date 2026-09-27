import 'server-only'
import { randomBytes } from 'node:crypto'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { verifyMessage } from 'viem'
import { db } from '@/db'
import { walletNonces, type WalletChain } from '@/db/wallet-schema'
import { env } from '../env'

/**
 * Address ownership proof.
 *
 * The user signs a challenge with the private key for an address; we recover
 * the signer and check it matches. This is the entire security boundary of the
 * non-custodial model, so the message format matters as much as the maths.
 *
 * Modelled on EIP-4361 (Sign-In with Ethereum). Every field in the message is
 * there to defeat a specific replay:
 *
 * - **domain**    a signature collected by another site cannot be used here
 * - **address**   it cannot be replayed to link a different address
 * - **chain**     it cannot be replayed onto a different network
 * - **nonce**     single-use, so a captured signature cannot be replayed at all
 * - **issued/expiry**  narrows the window a leaked signature is useful in
 *
 * Drop any one of these and the proof becomes forgeable in a way that is not
 * obvious from reading the happy path.
 */

/** Short window: the user signs within seconds of being shown the message. */
const NONCE_TTL_MS = 10 * 60 * 1000

export interface Challenge {
  nonce: string
  message: string
  expiresAt: string
}

function domainOf(appUrl: string): string {
  try {
    return new URL(appUrl).host
  } catch {
    return 'localhost'
  }
}

/**
 * Builds the message shown to the user before signing.
 *
 * Deliberately human-readable. People are told never to sign things they do not
 * understand, and a wall of hex trains exactly the habit that gets wallets
 * drained. It also states plainly that signing grants no spending authority,
 * because that is the question a careful user will have.
 */
export function buildMessage(input: {
  domain: string
  address: string
  chain: WalletChain
  nonce: string
  issuedAt: string
  expiresAt: string
}): string {
  return [
    `${input.domain} wants you to prove you control this address.`,
    '',
    'Signing this message costs nothing, moves no funds, and grants',
    'no permission to spend from your wallet. It only proves ownership.',
    '',
    `Address:   ${input.address}`,
    `Network:   ${input.chain}`,
    `Nonce:     ${input.nonce}`,
    `Issued:    ${input.issuedAt}`,
    `Expires:   ${input.expiresAt}`,
  ].join('\n')
}

/** EVM addresses are hex and case-insensitive; compare and store lower-cased. */
export function normaliseAddress(address: string): string {
  return address.trim().toLowerCase()
}

export function isValidEvmAddress(address: string): boolean {
  return /^0x[0-9a-f]{40}$/.test(normaliseAddress(address))
}

/** Issues a single-use challenge bound to this user, address and chain. */
export async function createChallenge(
  userId: string,
  address: string,
  chain: WalletChain,
): Promise<Challenge> {
  const normalised = normaliseAddress(address)
  const nonce = randomBytes(16).toString('hex')

  const issued = new Date()
  const expires = new Date(issued.getTime() + NONCE_TTL_MS)

  /**
   * `createdAt` is set explicitly rather than left to the column default.
   *
   * The signed message embeds the issue time, and verification rebuilds the
   * message from this row. If the column defaulted to Postgres `now()`, the
   * stored timestamp would differ from the JavaScript `new Date()` used to
   * build the message the user actually signed — and every valid signature
   * would be rejected because the rebuilt text no longer matched.
   */
  await db.insert(walletNonces).values({
    userId,
    nonce,
    address: normalised,
    chain,
    createdAt: issued,
    expiresAt: expires,
  })

  return {
    nonce,
    expiresAt: expires.toISOString(),
    message: buildMessage({
      domain: domainOf(env.APP_URL),
      address: normalised,
      chain,
      nonce,
      issuedAt: issued.toISOString(),
      expiresAt: expires.toISOString(),
    }),
  }
}

export type ProofFailure =
  | 'nonce_not_found'
  | 'nonce_expired'
  | 'nonce_consumed'
  | 'address_mismatch'
  | 'bad_signature'

export type ProofResult =
  | { ok: true; address: string; chain: WalletChain }
  | { ok: false; reason: ProofFailure }

/**
 * Verifies a signed challenge.
 *
 * Order matters: the nonce is consumed **before** the signature is checked.
 *
 * Consuming first means a wrong signature still burns the challenge, so an
 * attacker holding a captured message cannot grind signatures against a live
 * nonce. The cost is that a user who fumbles a signature must request a new
 * challenge — a trivial inconvenience against an unbounded retry window.
 */
export async function verifyChallenge(input: {
  userId: string
  nonce: string
  signature: string
}): Promise<ProofResult> {
  const now = new Date()

  // Atomic consume: scoped to this user, unconsumed, unexpired.
  const [challenge] = await db
    .update(walletNonces)
    .set({ consumedAt: now })
    .where(
      and(
        eq(walletNonces.nonce, input.nonce),
        eq(walletNonces.userId, input.userId),
        isNull(walletNonces.consumedAt),
        gt(walletNonces.expiresAt, now),
      ),
    )
    .returning()

  if (!challenge) {
    // Deliberately one reason for all three cases. Distinguishing "expired"
    // from "already used" from "never existed" tells a prober which nonces
    // were real.
    return { ok: false, reason: 'nonce_not_found' }
  }

  // Rebuild the message from stored values, never from client input — otherwise
  // the caller chooses what was "signed" and the proof means nothing.
  const message = buildMessage({
    domain: domainOf(env.APP_URL),
    address: challenge.address,
    chain: challenge.chain,
    nonce: challenge.nonce,
    issuedAt: challenge.createdAt.toISOString(),
    expiresAt: challenge.expiresAt.toISOString(),
  })

  let valid = false
  try {
    valid = await verifyMessage({
      address: challenge.address as `0x${string}`,
      message,
      signature: input.signature as `0x${string}`,
    })
  } catch {
    // Malformed signature — treat as a failure, never as a pass.
    return { ok: false, reason: 'bad_signature' }
  }

  if (!valid) return { ok: false, reason: 'bad_signature' }

  return { ok: true, address: challenge.address, chain: challenge.chain }
}

/**
 * NOTE — smart contract wallets (EIP-1271).
 *
 * `verifyMessage` here recovers an ECDSA signer, which covers externally owned
 * accounts. Safe, Argent and most account-abstraction wallets sign via a
 * contract and must be verified by calling `isValidSignature` on-chain instead.
 *
 * Those users currently cannot link. Supporting them needs a public client per
 * chain and a fallback to `verifyMessage` from `viem`'s contract-aware path —
 * worth doing before launch, since a growing share of wallets are contracts.
 */
