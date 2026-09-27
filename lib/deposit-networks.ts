/**
 * Deposit network catalogue.
 *
 * Shared by the admin form, the user-facing deposit screen and the server-side
 * validator, so all three agree on exactly one list. A network appearing in one
 * place and not another is how an address gets accepted for a chain the asset
 * does not exist on.
 *
 * `pattern` here is a *shape* check only — enough to give the admin immediate
 * feedback while typing. The authoritative check (base58 and bech32 checksums,
 * EIP-55) lives in `lib/server/address-validation.ts` and runs on every write.
 * Never treat a pattern match as proof an address is real.
 */

export interface DepositNetwork {
  id: string
  /** Full name, as the user should see it next to the address. */
  label: string
  /** Compact form for badges and table cells. */
  short: string
  /** Assets that genuinely exist on this chain. Nothing else may be assigned. */
  assetIds: readonly string[]
  /**
   * True when the destination is address + memo, not address alone.
   *
   * On these networks an exchange holds one address for every customer and
   * tells them apart by the tag. A transfer sent without it arrives at the
   * exchange unattributed and recovering it means a support ticket, if it is
   * recoverable at all — so the tag is required, not optional.
   */
  requiresTag: boolean
  /** Label for the tag field; the networks that use one do not agree on a name. */
  tagLabel?: string
  pattern: RegExp
}

export const DEPOSIT_NETWORKS: readonly DepositNetwork[] = [
  {
    id: 'bitcoin',
    label: 'Bitcoin',
    short: 'BTC',
    assetIds: ['btc'],
    requiresTag: false,
    pattern: /^(bc1[02-9ac-hj-np-z]{11,87}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/,
  },
  {
    id: 'ethereum',
    label: 'Ethereum (ERC-20)',
    short: 'ERC-20',
    assetIds: ['eth', 'usdt'],
    requiresTag: false,
    pattern: /^0x[0-9a-fA-F]{40}$/,
  },
  {
    id: 'bsc',
    label: 'BNB Smart Chain (BEP-20)',
    short: 'BEP-20',
    assetIds: ['bnb', 'usdt'],
    requiresTag: false,
    pattern: /^0x[0-9a-fA-F]{40}$/,
  },
  {
    id: 'tron',
    label: 'Tron (TRC-20)',
    short: 'TRC-20',
    assetIds: ['usdt'],
    requiresTag: false,
    pattern: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  },
  {
    id: 'solana',
    label: 'Solana',
    short: 'SOL',
    assetIds: ['sol', 'usdt'],
    requiresTag: false,
    pattern: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  },
  {
    id: 'polygon',
    label: 'Polygon',
    short: 'Polygon',
    assetIds: ['eth', 'usdt'],
    requiresTag: false,
    pattern: /^0x[0-9a-fA-F]{40}$/,
  },
  {
    id: 'arbitrum',
    label: 'Arbitrum One',
    short: 'Arbitrum',
    assetIds: ['eth', 'usdt'],
    requiresTag: false,
    pattern: /^0x[0-9a-fA-F]{40}$/,
  },
  {
    id: 'base',
    label: 'Base',
    short: 'Base',
    assetIds: ['eth', 'usdt'],
    requiresTag: false,
    pattern: /^0x[0-9a-fA-F]{40}$/,
  },
  {
    id: 'xrp',
    label: 'XRP Ledger',
    short: 'XRP',
    assetIds: ['xrp'],
    requiresTag: true,
    tagLabel: 'Destination tag',
    pattern: /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/,
  },
] as const

export const DEPOSIT_NETWORK_IDS = DEPOSIT_NETWORKS.map((network) => network.id)

export function getNetwork(id: string): DepositNetwork | undefined {
  return DEPOSIT_NETWORKS.find((network) => network.id === id)
}

/** Networks an asset can actually arrive on. Empty means deposits are impossible. */
export function networksForAsset(assetId: string): DepositNetwork[] {
  return DEPOSIT_NETWORKS.filter((network) => network.assetIds.includes(assetId))
}

export function supportsAsset(networkId: string, assetId: string): boolean {
  return getNetwork(networkId)?.assetIds.includes(assetId) ?? false
}

/** Human label for a stored network id, falling back to the raw value. */
export function networkLabel(id: string): string {
  return getNetwork(id)?.label ?? id
}

/**
 * Shortens an address for display without hiding the parts that matter.
 *
 * Keeps both ends: the leading characters identify the network and the trailing
 * ones are what a person compares against their wallet after pasting. A
 * truncation that shows only the start makes those two checks impossible, which
 * is precisely how address-swapping malware goes unnoticed.
 */
export function truncateAddress(address: string, edge = 8): string {
  if (address.length <= edge * 2 + 3) return address
  return `${address.slice(0, edge)}…${address.slice(-edge)}`
}
