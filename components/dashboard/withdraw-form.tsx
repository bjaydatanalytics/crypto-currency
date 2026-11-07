'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { listQuotes } from '@/lib/api/markets'
import { listBalances } from '@/lib/api/wallet'
import {
  listWithdrawalAddresses,
  requestWithdrawal,
  type WithdrawalAddress,
} from '@/lib/api/withdrawals'
import { networkLabel, truncateAddress } from '@/lib/deposit-networks'
import { formatMoney } from '@/lib/utils'

/**
 * Requesting a withdrawal.
 *
 * The amount is entered in USD, matching the rest of the panel, and converted
 * to asset units at the quoted price before submission — the asset figure is
 * shown first, because that is what actually leaves the account.
 *
 * Three things the design did not show but the endpoint requires, and which
 * are therefore here:
 *
 * - **A destination.** Payouts go only to addresses allow-listed in advance.
 *   There is no free-text address field anywhere in this flow; a withdrawal
 *   screen that accepts a pasted address is how a hijacked session empties an
 *   account.
 * - **A 2FA code**, re-checked at the moment funds would move rather than
 *   trusted from sign-in.
 * - **An idempotency key**, so a double-click cannot pay out twice.
 */

interface WalletOption {
  assetId: string
  symbol: string
  available: string
  price: number | null
}

export function WithdrawForm() {
  const { toast } = useToast()

  const [wallets, setWallets] = useState<WalletOption[]>([])
  const [addresses, setAddresses] = useState<WithdrawalAddress[]>([])
  const [pending, setPending] = useState<WithdrawalAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [addressId, setAddressId] = useState('')
  const [usd, setUsd] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [key, setKey] = useState(() => crypto.randomUUID())

  useEffect(() => {
    let active = true

    Promise.all([listBalances(), listQuotes(), listWithdrawalAddresses()])
      .then(([balances, quotes, saved]) => {
        if (!active) return
        const priceByAsset = new Map(quotes.data.map((q) => [q.assetId, q.price]))
        setWallets(
          balances.data.map((wallet) => ({
            assetId: wallet.assetId,
            symbol: wallet.symbol,
            available: String(wallet.available),
            price: priceByAsset.get(wallet.assetId) ?? null,
          })),
        )
        setAddresses(saved.addresses)
        setPending(saved.pending)
      })
      .catch((cause) => {
        if (!active) return
        setLoadError(
          cause instanceof Error ? cause.message : 'Could not load your withdrawal options.',
        )
      })
      .finally(() => active && setLoading(false))

    return () => {
      active = false
    }
  }, [])

  const destination = useMemo(
    () => addresses.find((entry) => entry.id === addressId) ?? null,
    [addresses, addressId],
  )

  const wallet = useMemo(
    () => wallets.find((entry) => entry.assetId === destination?.assetId) ?? null,
    [wallets, destination],
  )

  const usdAmount = Number(usd)
  const valid = Number.isFinite(usdAmount) && usdAmount > 0
  const assetAmount = valid && wallet?.price ? usdAmount / wallet.price : null
  const availableUsd = wallet?.price != null ? Number(wallet.available) * wallet.price : null
  const overBalance =
    assetAmount !== null && wallet !== null && assetAmount > Number(wallet.available)

  function amountError(): string | undefined {
    if (!valid || !destination) return undefined
    if (!wallet) return `You hold no ${destination.assetId.toUpperCase()} to withdraw.`
    if (wallet.price == null) return `No price is available for ${wallet.symbol} right now.`
    if (overBalance) return 'More than your available balance for that asset.'
    return undefined
  }

  const ready =
    destination !== null &&
    assetAmount !== null &&
    !overBalance &&
    /^\d{6}$/.test(totpCode) &&
    !busy

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!ready || !destination || assetAmount === null) return

    setBusy(true)
    setError(null)

    try {
      const result = await requestWithdrawal({
        assetId: destination.assetId,
        amount: assetAmount.toFixed(18).replace(/0+$/, '').replace(/\.$/, ''),
        addressId: destination.id,
        totpCode,
        idempotencyKey: key,
      })
      toast({ tone: 'success', title: 'Withdrawal requested', description: result.message })
      setUsd('')
      setTotpCode('')
      // A new key: the next request is a different request.
      setKey(crypto.randomUUID())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not request that withdrawal.')
    } finally {
      setBusy(false)
    }
  }

  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-muted">Loading your withdrawal options…</p>
        </CardBody>
      </Card>
    )
  }

  if (loadError) {
    return (
      <Card className="border-warn/30 bg-warn/[0.06]">
        <CardBody>
          <p className="text-sm font-medium text-warn">Withdrawals are not available to you yet</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink/80">{loadError}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Withdrawing requires a verified identity and two-factor authentication. Complete both
            and this form becomes available.
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <ButtonLink href="/dashboard/profile" size="sm">
              Verify identity
            </ButtonLink>
            <ButtonLink href="/dashboard/security#two-factor" variant="secondary" size="sm">
              Set up 2FA
            </ButtonLink>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardBody>
        <form onSubmit={submit} className="space-y-5">
          <Select
            label="Method"
            required
            value={addressId}
            onChange={(event) => setAddressId(event.target.value)}
            options={[
              { value: '', label: 'Select Gateway' },
              ...addresses.map((entry) => ({
                value: entry.id,
                label: `${entry.assetId.toUpperCase()} · ${networkLabel(entry.network)} · ${
                  entry.label ?? truncateAddress(entry.address)
                }`,
              })),
            ]}
            hint={
              addresses.length === 0
                ? 'You have no saved payout address yet.'
                : 'Funds go only to an address you saved in advance.'
            }
          />

          {addresses.length === 0 && (
            <p className="rounded-xl border border-line bg-elevate/[0.02] p-4 text-sm leading-relaxed text-muted">
              Add a payout address before withdrawing.{' '}
              <Link href="/dashboard/wallet" className="font-medium text-accent hover:underline">
                Manage addresses
              </Link>
              {pending.length > 0 && (
                <>
                  {' '}
                  You have {pending.length} address
                  {pending.length === 1 ? '' : 'es'} still in the cooling-off window — a newly
                  added address cannot be withdrawn to immediately.
                </>
              )}
            </p>
          )}

          <Input
            label="Amount"
            required
            value={usd}
            onChange={(event) => setUsd(event.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            suffix="USD"
            error={amountError()}
            hint={
              availableUsd !== null
                ? `$${formatMoney(availableUsd)} available in ${wallet?.symbol}`
                : undefined
            }
          />

          {assetAmount !== null && !overBalance && (
            <dl className="divide-y divide-line rounded-xl border border-line bg-elevate/[0.02]">
              <div className="flex items-baseline justify-between gap-3 p-3.5">
                <dt className="text-sm text-muted">You send</dt>
                <dd className="num text-sm text-ink">
                  {assetAmount.toFixed(8).replace(/\.?0+$/, '')} {wallet?.symbol}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 p-3.5">
                <dt className="text-sm text-muted">To</dt>
                <dd className="num text-sm text-ink">
                  {truncateAddress(destination!.address)}
                </dd>
              </div>
            </dl>
          )}

          <Input
            label="Authentication code"
            required
            value={totpCode}
            onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            hint="The six-digit code from your authenticator app."
          />

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-negative/30 bg-negative/[0.07] p-3.5 text-sm leading-relaxed text-negative"
            >
              {error}
            </p>
          )}

          <Button type="submit" fullWidth loading={busy} disabled={!ready}>
            Submit
          </Button>

          <p className="text-center text-xs leading-relaxed text-muted">
            Your funds are locked as soon as you submit, before any approval. A payout is
            released only after review by an operator.
          </p>
        </form>
      </CardBody>
    </Card>
  )
}

export function WithdrawHistoryLink() {
  return (
    <ButtonLink href="/dashboard/transactions" variant="navy" size="sm">
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
      Withdraw History
    </ButtonLink>
  )
}
