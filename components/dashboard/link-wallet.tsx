'use client'

import { useState } from 'react'
import { AlertTriangle, Link2, ShieldCheck, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { linkWallet, requestChallenge, type WalletChain } from '@/lib/api/wallets'

/**
 * Wallet linking dialog.
 *
 * Two-step proof: request a challenge, then sign it in the user's own wallet.
 * The signature never leaves their device except as a signature — no key, no
 * seed phrase, and the dialog says so, because "sign this" is exactly the
 * prompt drainer sites use and users are right to hesitate.
 */

const chains: Array<{ value: WalletChain; label: string }> = [
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'base', label: 'Base' },
  { value: 'arbitrum', label: 'Arbitrum' },
  { value: 'optimism', label: 'Optimism' },
  { value: 'polygon', label: 'Polygon' },
]

/** Minimal shape of an injected EIP-1193 provider. */
interface EthereumProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
}

function injectedProvider(): EthereumProvider | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as { ethereum?: EthereumProvider }).ethereum ?? null
}

export function LinkWalletDialog({
  open,
  onClose,
  onLinked,
}: {
  open: boolean
  onClose: () => void
  onLinked: () => void
}) {
  const { toast } = useToast()
  const [chain, setChain] = useState<WalletChain>('ethereum')
  const [address, setAddress] = useState('')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const hasWallet = injectedProvider() !== null

  async function connectWallet() {
    const provider = injectedProvider()
    if (!provider) return

    try {
      const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[]
      if (accounts?.[0]) setAddress(accounts[0])
    } catch {
      setError('Wallet connection was declined.')
    }
  }

  async function handleLink() {
    setBusy(true)
    setError(null)

    try {
      // 1. Ask the server for a single-use challenge bound to this address.
      const challenge = await requestChallenge(address.trim(), chain)
      setMessage(challenge.message)

      const provider = injectedProvider()
      if (!provider) {
        setError('No wallet extension detected. Install one, or use a device that has one.')
        setBusy(false)
        return
      }

      // 2. Sign it. personal_sign shows the text to the user before signing.
      const signature = (await provider.request({
        method: 'personal_sign',
        params: [challenge.message, address.trim().toLowerCase()],
      })) as string

      // 3. Server verifies and records the claim.
      await linkWallet({ nonce: challenge.nonce, signature, label: label.trim() || undefined })

      toast({
        tone: 'success',
        title: 'Wallet linked',
        description: 'Balances will now be read from this address.',
      })
      onLinked()
      onClose()
      setAddress('')
      setLabel('')
      setMessage(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not link that wallet.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Link a wallet"
      description="Prove you control an address so its balance appears here."
      size="md"
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-accent/25 bg-accent/[0.06] p-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <div className="text-sm leading-relaxed text-white/80">
            <p className="font-medium text-accent">This is read-only</p>
            <p className="mt-1">
              Signing proves the address is yours. It moves no funds, costs no gas and gives us
              no permission to spend. We never ask for a private key or seed phrase — nobody
              legitimate ever will.
            </p>
          </div>
        </div>

        <Select
          label="Network"
          options={chains}
          value={chain}
          onChange={(e) => setChain(e.target.value as WalletChain)}
        />

        <div>
          <Input
            label="Wallet address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x…"
            hint="The address you want to track."
          />
          {hasWallet && (
            <button
              type="button"
              onClick={connectWallet}
              className="mt-2 text-xs font-medium text-accent transition-colors hover:text-accent-bright"
            >
              Use my connected wallet
            </button>
          )}
        </div>

        <Input
          label="Label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Main wallet"
        />

        {message && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-muted">
              Message you are signing
            </p>
            <pre className="max-h-40 overflow-auto rounded-xl border border-line bg-base-800 p-3.5 text-[11px] leading-relaxed text-white/70">
              {message}
            </pre>
          </div>
        )}

        {!hasWallet && (
          <p className="flex items-start gap-2.5 rounded-lg border border-warn/25 bg-warn/[0.07] p-3.5 text-xs leading-relaxed text-white/80">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" aria-hidden="true" />
            No browser wallet detected. You can still request the message, but signing needs a
            wallet extension such as MetaMask or Rabby.
          </p>
        )}

        {error && (
          <p role="alert" className="rounded-lg border border-negative/30 bg-negative/[0.07] p-3.5 text-xs leading-relaxed text-negative">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <Button
            onClick={handleLink}
            loading={busy}
            disabled={address.trim().length < 10}
            className="sm:flex-1"
          >
            <Link2 className="h-4 w-4" aria-hidden="true" />
            Sign and link
          </Button>
          <Button variant="secondary" onClick={onClose} className="sm:flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export function NoWalletsEmptyState({ onLink }: { onLink: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-white/[0.03] text-muted">
        <Wallet className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="text-base font-medium text-white">No wallets linked</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
        Link a wallet to see its balance here. You keep your keys — linking is read-only and can
        be undone at any time.
      </p>
      <Button className="mt-6" onClick={onLink}>
        Link a wallet
      </Button>
    </div>
  )
}
