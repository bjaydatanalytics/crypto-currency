import 'server-only'
import { createHash } from 'node:crypto'
import { isAddress } from 'viem'
import { getNetwork } from '@/lib/deposit-networks'

/**
 * Receiving-address validation.
 *
 * This is the last check standing between an admin's keystroke and a customer
 * sending funds somewhere unrecoverable. A regex is not enough: `bc1q…` with one
 * character changed still matches the shape, and there is no undo on a
 * blockchain. So every format that carries a checksum is verified here —
 * base58check for Bitcoin legacy, Tron and XRP, bech32/bech32m for segwit,
 * EIP-55 for EVM chains.
 *
 * Where a format has no checksum at all (Solana's ed25519 public keys), that is
 * stated rather than papered over, and the UI asks the admin to confirm.
 */

export class AddressValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AddressValidationError'
  }
}

const BASE58_BITCOIN = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const BASE58_RIPPLE = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz'

function decodeBase58(input: string, alphabet: string): Uint8Array | null {
  if (input.length === 0) return null

  const bytes: number[] = [0]

  for (const character of input) {
    const value = alphabet.indexOf(character)
    if (value < 0) return null

    let carry = value
    for (let index = 0; index < bytes.length; index += 1) {
      carry += bytes[index] * 58
      bytes[index] = carry & 0xff
      carry >>= 8
    }
    while (carry > 0) {
      bytes.push(carry & 0xff)
      carry >>= 8
    }
  }

  // Each leading "zero" character is one leading zero byte the maths above drops.
  for (const character of input) {
    if (character !== alphabet[0]) break
    bytes.push(0)
  }

  return Uint8Array.from(bytes.reverse())
}

function sha256(data: Uint8Array): Uint8Array {
  return Uint8Array.from(createHash('sha256').update(data).digest())
}

/**
 * Verifies the trailing 4-byte double-SHA256 checksum and returns the payload.
 *
 * This is what makes a single mistyped character in a legacy address fail
 * loudly instead of silently pointing at an address nobody has keys to.
 */
function decodeBase58Check(input: string, alphabet: string): Uint8Array | null {
  const decoded = decodeBase58(input, alphabet)
  if (!decoded || decoded.length < 5) return null

  const payload = decoded.subarray(0, decoded.length - 4)
  const checksum = decoded.subarray(decoded.length - 4)
  const expected = sha256(sha256(payload)).subarray(0, 4)

  for (let index = 0; index < 4; index += 1) {
    if (checksum[index] !== expected[index]) return null
  }
  return payload
}

/* ------------------------------------------------------------------ */
/* bech32 / bech32m (BIP-173, BIP-350)                                 */
/* ------------------------------------------------------------------ */

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
const BECH32_CONST = 1
const BECH32M_CONST = 0x2bc830a3

function bech32Polymod(values: number[]): number {
  const generator = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]
  let checksum = 1

  for (const value of values) {
    const top = checksum >>> 25
    checksum = ((checksum & 0x1ffffff) << 5) ^ value
    for (let index = 0; index < 5; index += 1) {
      if ((top >>> index) & 1) checksum ^= generator[index]
    }
  }
  return checksum >>> 0
}

function bech32HrpExpand(hrp: string): number[] {
  const high: number[] = []
  const low: number[] = []
  for (const character of hrp) {
    const code = character.charCodeAt(0)
    high.push(code >> 5)
    low.push(code & 31)
  }
  return [...high, 0, ...low]
}

interface Bech32Decoded {
  hrp: string
  data: number[]
  encoding: 'bech32' | 'bech32m'
}

function decodeBech32(address: string): Bech32Decoded | null {
  // Mixed case is forbidden outright — it makes the checksum ambiguous.
  if (address !== address.toLowerCase() && address !== address.toUpperCase()) return null

  const value = address.toLowerCase()
  const separator = value.lastIndexOf('1')
  if (separator < 1 || separator + 7 > value.length || value.length > 90) return null

  const hrp = value.slice(0, separator)
  const data: number[] = []

  for (const character of value.slice(separator + 1)) {
    const index = BECH32_CHARSET.indexOf(character)
    if (index < 0) return null
    data.push(index)
  }

  const checksum = bech32Polymod([...bech32HrpExpand(hrp), ...data])
  const encoding =
    checksum === BECH32_CONST ? 'bech32' : checksum === BECH32M_CONST ? 'bech32m' : null

  if (!encoding) return null
  return { hrp, data: data.slice(0, -6), encoding }
}

/** Regroups 5-bit bech32 data into the 8-bit witness program. */
function convertBits(data: number[], from: number, to: number): number[] | null {
  let accumulator = 0
  let bits = 0
  const result: number[] = []
  const maxValue = (1 << to) - 1

  for (const value of data) {
    if (value < 0 || value >> from !== 0) return null
    accumulator = (accumulator << from) | value
    bits += from
    while (bits >= to) {
      bits -= to
      result.push((accumulator >> bits) & maxValue)
    }
  }

  // Leftover bits must be zero padding, never data.
  if (bits >= from || ((accumulator << (to - bits)) & maxValue) !== 0) return null
  return result
}

function isValidSegwitAddress(address: string): boolean {
  const decoded = decodeBech32(address)
  if (!decoded || decoded.hrp !== 'bc' || decoded.data.length === 0) return false

  const version = decoded.data[0]
  if (version > 16) return false

  // BIP-350: v0 uses bech32, every later version uses bech32m. Accepting the
  // wrong one would let a v0 address with a v1 checksum through.
  const expected = version === 0 ? 'bech32' : 'bech32m'
  if (decoded.encoding !== expected) return false

  const program = convertBits(decoded.data.slice(1), 5, 8)
  if (!program || program.length < 2 || program.length > 40) return false
  if (version === 0 && program.length !== 20 && program.length !== 32) return false

  return true
}

/* ------------------------------------------------------------------ */
/* Per-network validation                                              */
/* ------------------------------------------------------------------ */

function isValidBitcoinAddress(address: string): boolean {
  if (address.toLowerCase().startsWith('bc1')) return isValidSegwitAddress(address)

  const payload = decodeBase58Check(address, BASE58_BITCOIN)
  // 0x00 = P2PKH ("1…"), 0x05 = P2SH ("3…"). Testnet versions are refused: an
  // address that only works on testnet takes real mainnet funds nowhere.
  return payload !== null && payload.length === 21 && (payload[0] === 0x00 || payload[0] === 0x05)
}

function isValidTronAddress(address: string): boolean {
  const payload = decodeBase58Check(address, BASE58_BITCOIN)
  return payload !== null && payload.length === 21 && payload[0] === 0x41
}

function isValidXrpAddress(address: string): boolean {
  const payload = decodeBase58Check(address, BASE58_RIPPLE)
  return payload !== null && payload.length === 21 && payload[0] === 0x00
}

function isValidSolanaAddress(address: string): boolean {
  // No checksum exists in an ed25519 public key, so this is a length check and
  // nothing more. `checksummed` is false for Solana for exactly this reason.
  const decoded = decodeBase58(address, BASE58_BITCOIN)
  return decoded !== null && decoded.length === 32
}

const EVM_NETWORKS = new Set(['ethereum', 'bsc', 'polygon', 'arbitrum', 'base'])

export interface AddressCheck {
  valid: boolean
  /** False when the format carries no checksum — a typo cannot be detected. */
  checksummed: boolean
  reason?: string
}

/**
 * Validates a receiving address for a network.
 *
 * Returns a result rather than throwing so callers can render the reason next
 * to the field. Use `assertValidAddress` where a throw is wanted.
 */
export function checkAddress(networkId: string, address: string): AddressCheck {
  const network = getNetwork(networkId)
  if (!network) {
    return { valid: false, checksummed: false, reason: `Unknown network "${networkId}".` }
  }

  const trimmed = address.trim()
  if (trimmed !== address) {
    return {
      valid: false,
      checksummed: false,
      reason: 'The address has leading or trailing whitespace. Paste it again without spaces.',
    }
  }

  if (EVM_NETWORKS.has(networkId)) {
    // viem's isAddress accepts an all-lowercase address (which carries no
    // checksum to verify) and validates EIP-55 for anything else — including
    // all-uppercase, which it rejects. That is stricter than some wallets, and
    // deliberately kept: the cost is asking an operator to paste the normal
    // form, against a checksum check that catches a single mistyped character.
    const valid = isAddress(trimmed)
    const mixedCase = /[a-f]/.test(trimmed.slice(2)) && /[A-F]/.test(trimmed.slice(2))
    return {
      valid,
      checksummed: valid && mixedCase,
      reason: valid
        ? undefined
        : 'Not a valid address for this chain. Check the EIP-55 capitalisation — a mixed-case address with a bad checksum is a typo.',
    }
  }

  switch (networkId) {
    case 'bitcoin':
      return {
        valid: isValidBitcoinAddress(trimmed),
        checksummed: true,
        reason: isValidBitcoinAddress(trimmed) ? undefined : 'Not a valid Bitcoin address.',
      }
    case 'tron':
      return {
        valid: isValidTronAddress(trimmed),
        checksummed: true,
        reason: isValidTronAddress(trimmed) ? undefined : 'Not a valid Tron address.',
      }
    case 'xrp':
      return {
        valid: isValidXrpAddress(trimmed),
        checksummed: true,
        reason: isValidXrpAddress(trimmed) ? undefined : 'Not a valid XRP Ledger address.',
      }
    case 'solana':
      return {
        valid: isValidSolanaAddress(trimmed),
        checksummed: false,
        reason: isValidSolanaAddress(trimmed)
          ? undefined
          : 'Not a valid Solana address (must decode to 32 bytes).',
      }
    default:
      return {
        valid: false,
        checksummed: false,
        reason: `No validator is implemented for "${networkId}". Refusing rather than guessing.`,
      }
  }
}

export function assertValidAddress(networkId: string, address: string): AddressCheck {
  const result = checkAddress(networkId, address)
  if (!result.valid) {
    throw new AddressValidationError(result.reason ?? 'That address is not valid for this network.')
  }
  return result
}

/**
 * Validates a memo/destination tag.
 *
 * XRP tags are unsigned 32-bit integers. A tag outside that range, or one with
 * stray characters, is rejected by the destination exchange and the deposit
 * arrives unattributed.
 */
export function checkAddressTag(networkId: string, tag: string | null | undefined): AddressCheck {
  const network = getNetwork(networkId)
  if (!network) return { valid: false, checksummed: false, reason: 'Unknown network.' }

  const value = tag?.trim() ?? ''

  if (!value) {
    if (network.requiresTag) {
      return {
        valid: false,
        checksummed: false,
        reason: `${network.label} deposits need a ${network.tagLabel?.toLowerCase() ?? 'tag'}. Without one the transfer cannot be matched to an account.`,
      }
    }
    return { valid: true, checksummed: true }
  }

  if (networkId === 'xrp') {
    const valid = /^\d{1,10}$/.test(value) && Number(value) <= 4_294_967_295
    return {
      valid,
      checksummed: true,
      reason: valid ? undefined : 'A destination tag is a whole number from 0 to 4294967295.',
    }
  }

  const valid = /^[\w-]{1,64}$/.test(value)
  return { valid, checksummed: true, reason: valid ? undefined : 'That tag contains characters the network does not accept.' }
}
