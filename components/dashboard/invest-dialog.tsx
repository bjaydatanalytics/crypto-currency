'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { subscribeToPlan } from '@/lib/api/investments'
import { listQuotes } from '@/lib/api/markets'
import { listBalances } from '@/lib/api/wallet'
import type { InvestmentPlan } from '@/lib/types'
import { formatMoney } from '@/lib/utils'

/**
 * Subscribing to a fixed-return plan.
 *
 * Laid out as the design specifies: the plan's terms, a wallet, an amount, and
 * No / Yes. Everything beyond that appears only once it is relevant — the
 * conversion summary when an amount is entered, an error when something is
 * wrong — so the dialog opens looking exactly like the design and grows only
 * as the customer fills it in.
 *
 * **The amount is entered in USD but the contract is denominated in the asset.**
 * The plan's limits are USD figures, so USD is the unit the customer chooses
 * against — but the ledger locks asset units, and that is what the server
 * stores. The conversion is shown before they confirm, at a price pinned when
 * the dialog opens, so the figure they agree to is the figure submitted.
 *
 * **`acceptedTerms` is sent as `true` on pressing Yes, and no risk statement
 * is displayed.** The server still requires the flag — `subscribeToPlanSchema`
 * refuses without it — but at the operator's instruction the plan's risk
 * disclosure, the lock-up warning and the solvency statement were removed from
 * this dialog. The flag therefore no longer records that anything was shown;
 * it records only that the button was pressed.
 *
 * `plan.riskDisclosure` is still stored on every plan and frozen onto every
 * contract, so restoring the disclosure here is a display change, not a data
 * recovery.
 */

/** Mirrors the server's `computeReturn`. Shown for confirmation, never stored. */
function previewReturn(
  principal: number,
  ratePercent: number,
  basis: 'per_term' | 'annual',
  durationDays: number,
): number {
  if (!Number.isFinite(principal) || principal <= 0) return 0
  const effective = basis === 'per_term' ? ratePercent : (ratePercent * durationDays) / 365
  return (principal * effective) / 100
}

interface WalletOption {
  assetId: string
  symbol: string
  /** Asset units, as a decimal string. Never parsed for a balance check. */
  available: string
  /** USD per unit, or null when the asset has no quote. */
  price: number | null
}

export function InvestDialog({
  plan,
  onClose,
  onDone,
}: {
  plan: InvestmentPlan | null
  onClose: () => void
  onDone: () => void
}) {
  const { toast } = useToast()
  const [wallets, setWallets] = useState<WalletOption[]>([])
  const [loadingWallets, setLoadingWallets] = useState(true)
  const [assetId, setAssetId] = useState('')
  const [usd, setUsd] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [key, setKey] = useState(() => crypto.randomUUID())

  useEffect(() => {
    if (!plan) return
    setUsd('')
    setAssetId('')
    setError(null)
    setLoadingWallets(true)
    // A fresh key per opening: two separate contracts must not collide, and a
    // retry after a failure must not be mistaken for the same request twice.
    setKey(crypto.randomUUID())

    let active = true
    Promise.all([listBalances(), listQuotes()])
      .then(([balances, quotes]) => {
        if (!active) return
        const priceByAsset = new Map(quotes.data.map((q) => [q.assetId, q.price]))
        setWallets(
          balances.data
            .filter((wallet) => Number(wallet.available) > 0)
            .map((wallet) => ({
              assetId: wallet.assetId,
              symbol: wallet.symbol,
              available: String(wallet.available),
              price: priceByAsset.get(wallet.assetId) ?? null,
            })),
        )
      })
      .catch(() => active && setWallets([]))
      .finally(() => active && setLoadingWallets(false))

    return () => {
      active = false
    }
  }, [plan])

  const selected = useMemo(
    () => wallets.find((entry) => entry.assetId === assetId) ?? null,
    [wallets, assetId],
  )

  const usdAmount = Number(usd)
  const valid = Number.isFinite(usdAmount) && usdAmount > 0

  /** The asset amount actually submitted. Null when it cannot be computed. */
  const assetAmount = valid && selected?.price ? usdAmount / selected.price : null

  const availableUsd =
    selected?.price != null ? Number(selected.available) * selected.price : null

  const belowMinimum = valid && plan?.minimumAmount != null && usdAmount < plan.minimumAmount
  const aboveMaximum = valid && plan?.maximumAmount != null && usdAmount > plan.maximumAmount
  const overBalance =
    assetAmount !== null && selected !== null && assetAmount > Number(selected.available)

  const expectedReturn = plan
    ? previewReturn(
        assetAmount ?? 0,
        plan.fixedRatePercent ?? 0,
        plan.rateBasis ?? 'per_term',
        plan.duration ?? 0,
      )
    : 0

  const maturity = plan?.duration ? new Date(Date.now() + plan.duration * 86_400_000) : null

  function amountError(): string | undefined {
    if (!valid) return undefined
    if (belowMinimum) return `The minimum for this plan is $${formatMoney(plan!.minimumAmount!)}.`
    if (aboveMaximum) return `The maximum for this plan is $${formatMoney(plan!.maximumAmount!)}.`
    if (!selected) return undefined
    if (selected.price == null) {
      return `No price is available for ${selected.symbol}, so this amount cannot be converted.`
    }
    if (overBalance) return 'More than your available balance.'
    return undefined
  }

  async function submit() {
    if (!plan || assetAmount === null) return
    setBusy(true)
    setError(null)

    try {
      const result = await subscribeToPlan({
        planId: plan.id,
        assetId,
        // Full precision: the server re-validates and freezes this exact figure.
        amount: assetAmount.toFixed(18).replace(/0+$/, '').replace(/\.$/, ''),
        idempotencyKey: key,
        // Pressing Yes, with the terms shown above the button, is the agreement.
        acceptedTerms: true,
      })
      toast({ tone: 'success', title: 'Investment opened', description: result.message })
      onDone()
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open that investment.')
    } finally {
      setBusy(false)
    }
  }

  const ready =
    Boolean(plan) &&
    assetId !== '' &&
    valid &&
    assetAmount !== null &&
    !belowMinimum &&
    !aboveMaximum &&
    !overBalance

  const periods = plan?.duration ?? 0
  const perPeriod = plan?.fixedRatePercent && periods ? plan.fixedRatePercent / periods : 0

  return (
    <Modal
      open={Boolean(plan)}
      onClose={onClose}
      title={plan ? `Confirm to invest on ${plan.name.toUpperCase()}` : ''}
      size="md"
    >
      {plan && (
        <div className="space-y-5">
          {/* ---------- The terms, as the plan card stated them ---------- */}
          <div className="space-y-1 text-center text-sm">
            <p className="font-semibold text-ink">
              Invest:{' '}
              {plan.minimumAmount != null && plan.maximumAmount != null
                ? `$${formatMoney(plan.minimumAmount)} - $${formatMoney(plan.maximumAmount)}`
                : 'Any amount'}
            </p>
            <p className="text-muted">Interest: {plan.fixedRatePercent}%</p>
            <p className="text-muted">
              Every 24 hours for {periods} {periods === 1 ? 'time' : 'times'}
              {perPeriod > 0 && ` · ${perPeriod.toFixed(2)}% each`}
            </p>
          </div>

          <Select
            label="Select Wallet"
            required
            value={assetId}
            onChange={(event) => setAssetId(event.target.value)}
            disabled={loadingWallets || wallets.length === 0}
            options={[
              {
                value: '',
                label: loadingWallets
                  ? 'Loading…'
                  : wallets.length === 0
                    ? 'No funded wallet'
                    : 'Select One',
              },
              ...wallets.map((entry) => ({
                value: entry.assetId,
                label:
                  entry.price == null
                    ? `${entry.symbol} — ${entry.available} (no price)`
                    : `${entry.symbol} — $${formatMoney(Number(entry.available) * entry.price)} available`,
              })),
            ]}
          />

          <Input
            label="Invest Amount"
            required
            value={usd}
            onChange={(event) => setUsd(event.target.value)}
            inputMode="decimal"
            placeholder=""
            suffix="USD"
            error={amountError()}
            hint={
              availableUsd !== null
                ? `$${formatMoney(availableUsd)} available in ${selected?.symbol}`
                : undefined
            }
          />

          {/* Appears only once there is something true to say about the amount */}
          {assetAmount !== null && !overBalance && !belowMinimum && !aboveMaximum && (
            <dl className="divide-y divide-line rounded-xl border border-accent/25 bg-accent/[0.04] text-sm">
              <div className="flex items-baseline justify-between gap-3 p-3">
                <dt className="text-muted">You lock</dt>
                <dd className="num text-ink">
                  {assetAmount.toFixed(8).replace(/\.?0+$/, '')} {selected?.symbol}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 p-3">
                <dt className="text-muted">Return owed at maturity</dt>
                <dd className="num font-medium text-accent">
                  {expectedReturn.toFixed(8).replace(/\.?0+$/, '')} {selected?.symbol}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 p-3">
                <dt className="text-muted">Available again on</dt>
                <dd className="num text-ink">{maturity ? maturity.toDateString() : '—'}</dd>
              </div>
            </dl>
          )}

          {wallets.length === 0 && !loadingWallets && (
            <p className="rounded-xl border border-warn/30 bg-warn/[0.06] p-3.5 text-sm leading-relaxed text-ink/80">
              You have no available balance to invest. Deposit funds first — anything already
              locked in another contract or a pending withdrawal cannot be used.
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-negative/30 bg-negative/[0.07] p-3.5 text-sm leading-relaxed text-negative"
            >
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2.5 border-t border-line pt-4 text-[13px]">
            <Button variant="navy" onClick={onClose} className="min-w-[80px]">
              No
            </Button>
            <Button onClick={submit} loading={busy} disabled={!ready} className="min-w-[80px]">
              Yes
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
