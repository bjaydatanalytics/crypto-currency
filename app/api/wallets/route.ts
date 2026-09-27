import { and, desc, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { linkedWallets, walletChainEnum } from '@/db/wallet-schema'
import { conflict, created, fail, ok, parseBody, withErrorHandling } from '@/lib/server/api'
import { AuditAction, recordAudit } from '@/lib/server/audit'
import { requireVerifiedUser } from '@/lib/server/guard'
import { sendSecurityAlert } from '@/lib/server/mailer'
import { getRequestContext } from '@/lib/server/session'
import { verifyChallenge } from '@/lib/server/wallets/proof'

const linkSchema = z.object({
  nonce: z.string().trim().length(32),
  signature: z
    .string()
    .trim()
    .regex(/^0x[0-9a-fA-F]+$/, 'Signature must be a hex string.'),
  label: z.string().trim().max(64).optional(),
})

/** GET — wallets this user has proven control of. */
export const GET = withErrorHandling(async () => {
  const guard = await requireVerifiedUser()
  if (!guard.ok) return guard.response

  const rows = await db
    .select()
    .from(linkedWallets)
    .where(
      and(
        eq(linkedWallets.userId, guard.user.id),
        eq(linkedWallets.status, 'active'),
        isNull(linkedWallets.revokedAt),
      ),
    )
    .orderBy(desc(linkedWallets.createdAt))

  return ok({
    wallets: rows.map((row) => ({
      id: row.id,
      chain: row.chain,
      address: row.address,
      label: row.label,
      verifiedAt: row.verifiedAt.toISOString(),
      lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    })),
    supportedChains: walletChainEnum.enumValues,
  })
})

/**
 * POST — link a wallet by proving control of it.
 *
 * The address is taken from the *stored challenge*, never from the request
 * body. If the caller could name the address, they could sign with a key they
 * own and claim an address they do not.
 *
 * Linking grants the platform nothing: no key, no spending authority, no
 * ability to move funds. It records a claim we have verified, so the dashboard
 * knows which addresses to read.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const guard = await requireVerifiedUser()
  if (!guard.ok) return guard.response

  const parsed = await parseBody(request, linkSchema)
  if (!parsed.success) return parsed.response

  const context = await getRequestContext()

  const proof = await verifyChallenge({
    userId: guard.user.id,
    nonce: parsed.data.nonce,
    signature: parsed.data.signature,
  })

  if (!proof.ok) {
    await recordAudit({
      actorId: guard.user.id,
      actorRole: guard.user.role,
      action: AuditAction.LoginFailed,
      targetType: 'wallet_link',
      metadata: { reason: proof.reason },
      context,
    })

    return fail(
      'proof_failed',
      proof.reason === 'bad_signature'
        ? 'That signature does not match the address. Try linking again.'
        : 'That challenge is no longer valid. Request a new one and sign it.',
      400,
    )
  }

  const [row] = await db
    .insert(linkedWallets)
    .values({
      userId: guard.user.id,
      chain: proof.chain,
      address: proof.address,
      label: parsed.data.label,
      verifiedAt: new Date(),
    })
    .onConflictDoNothing({
      target: [linkedWallets.userId, linkedWallets.chain, linkedWallets.address],
    })
    .returning()

  if (!row) return conflict('That wallet is already linked to your account.')

  // A linked address is a change to what the account watches, so the owner is
  // told — the same reason a new withdrawal address triggers an alert.
  await sendSecurityAlert(
    guard.user.email,
    `A wallet was linked to your account: ${proof.address} on ${proof.chain}. ` +
      'Linking is read-only and grants no access to your funds.',
  )

  await recordAudit({
    actorId: guard.user.id,
    actorRole: guard.user.role,
    action: AuditAction.ProfileUpdated,
    targetType: 'linked_wallet',
    targetId: row.id,
    metadata: { chain: proof.chain, address: proof.address },
    context,
  })

  return created({
    id: row.id,
    chain: row.chain,
    address: row.address,
    label: row.label,
    verifiedAt: row.verifiedAt.toISOString(),
  })
})
