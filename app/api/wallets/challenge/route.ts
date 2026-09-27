import { z } from 'zod'
import { ok, badRequest, parseBody, tooManyRequests, withErrorHandling } from '@/lib/server/api'
import { requireVerifiedUser } from '@/lib/server/guard'
import { RULES, checkRateLimit } from '@/lib/server/rate-limit'
import { createChallenge, isValidEvmAddress, normaliseAddress } from '@/lib/server/wallets/proof'
import { walletChainEnum } from '@/db/wallet-schema'

const challengeSchema = z.object({
  address: z.string().trim().min(10).max(64),
  chain: z.enum(walletChainEnum.enumValues),
})

/**
 * POST — issue a signing challenge.
 *
 * Step one of linking a wallet. Returns a human-readable message the user signs
 * in their own wallet; step two (`POST /api/wallets`) verifies it.
 *
 * Rate limited because each call writes a nonce row, and an unbounded issuer is
 * free storage for anyone who wants to fill the table.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const guard = await requireVerifiedUser()
  if (!guard.ok) return guard.response

  const limit = await checkRateLimit(`wallet-challenge:${guard.user.id}`, RULES.twoFactor)
  if (!limit.allowed) {
    return tooManyRequests('Too many attempts. Try again shortly.', limit.retryAfterSeconds)
  }

  const parsed = await parseBody(request, challengeSchema)
  if (!parsed.success) return parsed.response

  const address = normaliseAddress(parsed.data.address)
  if (!isValidEvmAddress(address)) {
    return badRequest('That is not a valid address for this network.', {
      address: 'Enter a valid 0x address.',
    })
  }

  const challenge = await createChallenge(guard.user.id, address, parsed.data.chain)
  return ok(challenge)
})
