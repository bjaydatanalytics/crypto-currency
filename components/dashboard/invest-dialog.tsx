'use client'

import { useEffect, useMemo, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { subscribeToPlan } from '@/lib/api/investments'
import { listBalances } from '@/lib/api/wallet'
import type { InvestmentPlan } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

/**
 * Subscribing to a fixed-return plan.
 *
 * This dialog commits the customer to a contract, so it shows the whole of it
 * before they can agree: the exact payout, the exact date, and the fact that
 * the money is locked until then. Three things it deliberately does not do:
 *
 * - **No projected or illustrative figures.** The payout shown is the payout
 *   owed, computed from the same rate the server will freeze onto the contract.
 * - **No pre-ticked agreement.** They tick it, or nothing happens.
 * - **No softening of the lock.** Funds are unavailable for the full term, and
 *   there are no early-exit terms. Saying so here is cheaper than saying it to
 *   somebody who needed the money back in a week.
 */

/** Mirrors the server's `computeReturn`. Shown for confirmation, never stored. */
function previewReturn(
  amount: string,
  ratePercent: number,
  basis: 'per_term' | 'annual',
  durationDays: number,
): number {
  const principal = Number(amount)
  if (!Number.isFinite(principal) || principal <= 0) return 0
  const effective = basis === 'per_term' ? ratePercent : (ratePercent * durationDays) / 365
  return (principal * effective) / 100
}

function describeRate(plan: InvestmentPlan): string {
  if (plan.fixedRatePercent === null || plan.fixedRatePercent === undefined) return 'No return'
  return plan.rateBasis === 'annual'
    ? `${plan.fixedRatePercent}% a year`
    : `${plan.fixedRatePercent}% over the term`
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
  const [assets, setAssets] = useState<Array<{ assetId: string; symbol: string; available: string }>>([])
  const [assetId, setAssetId] = useState('')
  const [amount, setAmount] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [key] = useState(() => `sub-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)

  useEffect(() => {
    if (!plan) return
    setAmount('')
    setAccepted(false)
    setError(null)

    listBalances()
      .then(({ data }) => {
        const funded = data
          .filter((wallet) => Number(wallet.available) > 0)
          .map((wallet) => ({
            assetId: wallet.assetId,
            symbol: wallet.symbol,
            available: String(wallet.available),
          }))
        setAssets(funded)
        setAssetId((current) => current || (funded[0]?.assetId ?? ''))
      })
      .catch(() => setAssets([]))
  }, [plan])

  const selected = useMemo(
    () => assets.find((entry) => entry.assetId === assetId) ?? null,
    [assets, assetId],
  )

  const expected = plan
    ? previewReturn(
        amount,
        plan.fixedRatePercent ?? 0,
        plan.rateBasis ?? 'per_term',
        plan.duration ?? 0,
      )
    : 0

  const maturity = plan?.duration
    ? new Date(Date.now() + plan.duration * 86_400_000)
    : null

  const overBalance = selected !== null && Number(amount) > Number(selected.available)

  async function submit() {
    if (!plan) return
    setBusy(true)
    setError(null)

    try {
      const result = await subscribeToPlan({
        planId: plan.id,
        assetId,
        amount: amount.trim(),
        idempotencyKey: key,
        acceptedTerms: accepted,
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
    Boolean(plan) && assetId !== '' && Number(amount) > 0 && !overBalance && accepted

  return (
    <Modal
      open={Boolean(plan)}
      onClose={onClose}
      title={plan ? `Invest in ${plan.name}` : ''}
      description="Your funds are locked for the full term."
      size="lg"
    >
      {plan && (
        <div className="space-y-5">
          <dl className="grid gap-4 rounded-xl border border-line bg-base-800 p-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">Return</dt>
              <dd className="mt-1 text-sm font-medium text-accent">{describeRate(plan)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">Term</dt>
              <dd className="num mt-1 text-sm text-white">
                {plan.duration ? `${plan.duration} days` : 'Open-ended'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">Minimum</dt>
              <dd className="num mt-1 text-sm text-white">
                {plan.minimumAmount === null
                  ? 'None'
                  : formatCurrency(plan.minimumAmount, { currency: plan.currency })}
              </dd>
            </div>
          </dl>

          {assets.length === 0 ? (
            <p className="rounded-xl border border-warn/30 bg-warn/[0.06] p-4 text-sm leading-relaxed text-white/80">
              You have no available balance to invest. Deposit funds first — anything already
              locked in another contract or a pending withdrawal cannot be used.
            </p>
          ) : (
            <>
              <Select
                label="Pay from"
                value={assetId}
                onChange={(event) => setAssetId(event.target.value)}
                options={assets.map((entry) => ({
                  value: entry.assetId,
                  label: `${entry.symbol} — ${entry.available} available`,
                }))}
              />

              <Input
                label={`Amount${selected ? ` (${selected.symbol})` : ''}`}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                error={overBalance ? 'More than your available balance.' : undefined}
                hint={
                  selected ? `${selected.available} ${selected.symbol} available` : undefined
                }
              />

              {Number(amount) > 0 && !overBalance && (
                <dl className="divide-y divide-line rounded-xl border border-accent/25 bg-accent/[0.04]">
                  <div className="flex items-baseline justify-between gap-3 p-3.5">
                    <dt className="text-sm text-muted">You lock</dt>
                    <dd className="num text-sm text-white">
                      {amount} {selected?.symbol}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 p-3.5">
                    <dt className="text-sm text-muted">Return owed at maturity</dt>
                    <dd className="num text-sm font-medium text-accent">
                      {expected.toFixed(8).replace(/\.?0+$/, '')} {selected?.symbol}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 p-3.5">
                    <dt className="text-sm text-muted">Available again on</dt>
                    <dd className="num text-sm text-white">
                      {maturity ? maturity.toDateString() : '—'}
                    </dd>
                  </div>
                </dl>
              )}
            </>
          )}

          <div className="flex items-start gap-3 rounded-xl border border-warn/30 bg-warn/[0.06] p-4">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
            <div className="text-sm leading-relaxed text-white/80">
              <p className="font-medium text-warn">Read this before you agree</p>
              <ul className="mt-1.5 space-y-1">
                <li>
                  Your funds are locked for the full term. There are no early-exit terms — you
                  cannot withdraw this amount before maturity.
                </li>
                <li>
                  The return is owed contractually, but paying it depends on this platform
                  remaining solvent. It is not a bank deposit and no deposit guarantee scheme
                  protects it.
                </li>
                <li>{plan.riskDisclosure}</li>
              </ul>
              {plan.yieldSource && (
                <p className="mt-2 text-xs text-muted">
                  Stated source of the return: {plan.yieldSource}
                </p>
              )}
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--accent,#B8FF00)]"
            />
            <span className="text-sm leading-relaxed text-white/80">
              I have read the terms above, I understand my funds are locked for the full term,
              and I accept that payment of the return depends on the platform&apos;s solvency.
            </span>
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-negative/30 bg-negative/[0.07] p-3.5 text-xs leading-relaxed text-negative"
            >
              {error}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <Button onClick={submit} loading={busy} disabled={!ready} className="sm:flex-1">
              Lock funds and open contract
            </Button>
            <Button variant="secondary" onClick={onClose} className="sm:flex-1">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
