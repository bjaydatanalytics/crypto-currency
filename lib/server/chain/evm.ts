import 'server-only'
import { createPublicClient, formatUnits, http, type PublicClient } from 'viem'
import { arbitrum, base, mainnet, optimism, polygon } from 'viem/chains'
import type { WalletChain } from '@/db/wallet-schema'

/**
 * EVM chain reader.
 *
 * In the non-custodial model this replaces the ledger as the source of truth
 * for what a user holds. The platform reports what the chain says; it does not
 * own the number.
 *
 * That inversion is the whole point, and it changes the failure mode: if this
 * reader is down we must show "could not read" rather than a stale or assumed
 * balance. A custodial ledger can always answer from its own records — a chain
 * reader cannot, and pretending otherwise would display a figure nothing backs.
 */

const CHAIN_CONFIG = {
  ethereum: { chain: mainnet, symbol: 'ETH', decimals: 18, assetId: 'eth' },
  polygon: { chain: polygon, symbol: 'POL', decimals: 18, assetId: 'pol' },
  arbitrum: { chain: arbitrum, symbol: 'ETH', decimals: 18, assetId: 'eth' },
  base: { chain: base, symbol: 'ETH', decimals: 18, assetId: 'eth' },
  optimism: { chain: optimism, symbol: 'ETH', decimals: 18, assetId: 'eth' },
} as const satisfies Record<WalletChain, unknown>

/**
 * RPC endpoint per chain.
 *
 * Falls back to viem's bundled public endpoints, which work without a key and
 * are fine for a prototype. They are rate limited and offer no uptime promise —
 * set `EVM_RPC_<CHAIN>` to a dedicated provider (Alchemy, Infura, QuickNode)
 * before this serves real users.
 */
function rpcUrlFor(chain: WalletChain): string | undefined {
  const key = `EVM_RPC_${chain.toUpperCase()}` as const
  return process.env[key] || undefined
}

const clients = new Map<WalletChain, PublicClient>()

function clientFor(chain: WalletChain): PublicClient {
  const cached = clients.get(chain)
  if (cached) return cached

  const config = CHAIN_CONFIG[chain]
  const client = createPublicClient({
    chain: config.chain,
    transport: http(rpcUrlFor(chain), {
      timeout: 10_000,
      retryCount: 2,
    }),
  }) as PublicClient

  clients.set(chain, client)
  return client
}

export interface NativeBalance {
  chain: WalletChain
  address: string
  assetId: string
  symbol: string
  /** Decimal string in whole units. Never a float. */
  amount: string
  /** Raw base units (wei), for anything that must not lose precision. */
  raw: string
  blockNumber: string
  readAt: string
}

export class ChainReadError extends Error {
  constructor(
    readonly chain: WalletChain,
    readonly address: string,
    message: string,
  ) {
    super(message)
    this.name = 'ChainReadError'
  }
}

/**
 * Reads the native balance of one address.
 *
 * Returns the amount as a decimal *string* via `formatUnits`. Converting wei to
 * a JavaScript number loses precision above 2^53 — about 0.009 ETH worth of
 * wei — so the value stays textual all the way to the UI.
 */
export async function readNativeBalance(
  chain: WalletChain,
  address: string,
): Promise<NativeBalance> {
  const config = CHAIN_CONFIG[chain]
  const client = clientFor(chain)

  try {
    const [raw, blockNumber] = await Promise.all([
      client.getBalance({ address: address as `0x${string}` }),
      client.getBlockNumber(),
    ])

    return {
      chain,
      address,
      assetId: config.assetId,
      symbol: config.symbol,
      amount: formatUnits(raw, config.decimals),
      raw: raw.toString(),
      blockNumber: blockNumber.toString(),
      readAt: new Date().toISOString(),
    }
  } catch (error) {
    throw new ChainReadError(
      chain,
      address,
      error instanceof Error ? error.message : 'RPC request failed',
    )
  }
}

export interface BalanceReadResult {
  balances: NativeBalance[]
  /** Addresses the reader could not reach. Surfaced, never silently dropped. */
  failures: Array<{ chain: WalletChain; address: string; reason: string }>
}

/**
 * Reads balances for many wallets concurrently.
 *
 * Partial failure is normal — one chain's RPC can be down while others are
 * fine. Failures are returned alongside the successes so the UI can say which
 * wallets it could not read, instead of rendering them as zero. A wallet shown
 * as empty when the RPC simply timed out is a bug the user would act on.
 */
export async function readBalances(
  wallets: Array<{ chain: WalletChain; address: string }>,
): Promise<BalanceReadResult> {
  const settled = await Promise.allSettled(
    wallets.map((wallet) => readNativeBalance(wallet.chain, wallet.address)),
  )

  const balances: NativeBalance[] = []
  const failures: BalanceReadResult['failures'] = []

  settled.forEach((outcome, index) => {
    if (outcome.status === 'fulfilled') {
      balances.push(outcome.value)
    } else {
      const wallet = wallets[index]
      failures.push({
        chain: wallet.chain,
        address: wallet.address,
        reason:
          outcome.reason instanceof ChainReadError
            ? outcome.reason.message
            : 'Could not read balance',
      })
    }
  })

  return { balances, failures }
}

/** Whether a dedicated RPC is configured, for the health endpoint. */
export function rpcStatus() {
  const chains = Object.keys(CHAIN_CONFIG) as WalletChain[]
  return chains.map((chain) => ({
    chain,
    dedicated: Boolean(rpcUrlFor(chain)),
  }))
}

export { CHAIN_CONFIG }
