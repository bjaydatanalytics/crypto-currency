import 'server-only'

/**
 * Confirmation requirements.
 *
 * What replaced the custody-provider abstraction. The platform runs a
 * centralised model: funds arrive at accounts the business controls, and an
 * operator credits them. There is no API to ask how many confirmations a
 * transfer has, so the threshold is a policy decision made here and enforced
 * when a deposit is credited.
 *
 * These are the numbers below which a chain reorganisation is a realistic
 * risk. Raise them for large amounts; never lower them for speed. Crediting
 * early is how a platform pays out against a transaction that later vanishes.
 */

export const DEFAULT_CONFIRMATIONS: Record<string, number> = {
  btc: 3,
  eth: 12,
  sol: 32,
  usdt: 12,
  bnb: 15,
  xrp: 4,
}

/**
 * Per-network overrides, where the network matters more than the asset.
 *
 * USDT is the case that forces this: the same token needs 12 confirmations on
 * Ethereum and around 20 on Tron, whose blocks are far faster and individually
 * far cheaper to reorganise.
 */
const NETWORK_CONFIRMATIONS: Record<string, number> = {
  bitcoin: 3,
  ethereum: 12,
  bsc: 15,
  tron: 20,
  solana: 32,
  polygon: 128,
  arbitrum: 20,
  base: 20,
  xrp: 4,
}

export function defaultConfirmationsFor(assetId: string, network?: string): number {
  if (network && NETWORK_CONFIRMATIONS[network] !== undefined) {
    return NETWORK_CONFIRMATIONS[network]
  }
  // An unknown asset gets the highest requirement rather than the lowest.
  return DEFAULT_CONFIRMATIONS[assetId.toLowerCase()] ?? 32
}
