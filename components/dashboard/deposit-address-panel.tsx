'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Copy, Info, QrCode, ShieldAlert } from 'lucide-react'
import { AssetIcon } from '@/components/ui/asset-icon'
import { Badge } from '@/components/ui/badge'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Select } from '@/components/ui/select'
import { SkeletonRows } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import {
  fetchMyDepositAddresses,
  type AssetSummary,
  type UserDepositAddress,
} from '@/lib/api/deposit-addresses'

/**
 * The user's deposit address.
 *
 * Everything on this screen is either returned by the server for this account
 * or absent. Nothing is filled in with a placeholder, an example or a previous
 * value, because a string in this position is a string somebody sends money to.
 *
 * The address is rendered in full, never truncated. A person's only defence
 * against an address swapped in transit — by malware, an extension, a
 * screenshot from a scammer — is comparing what their wallet shows against
 * every character of what they were given.
 */

function CopyField({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access is refused in some browsers and every insecure
      // context. Say so — a silently failed copy leads to a hand-typed address.
      toast({
        tone: 'warn',
        title: 'Could not copy',
        description: 'Select the text and copy it manually, then check every character.',
      })
    }
  }, [toast, value])

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              Copy
            </>
          )}
        </button>
      </div>
      <p
        className={
          emphasis
            ? 'num break-all rounded-xl border border-warn/30 bg-warn/[0.06] p-3.5 text-sm leading-relaxed text-white'
            : 'num break-all rounded-xl border border-line bg-base-800 p-3.5 text-sm leading-relaxed text-white'
        }
      >
        {value}
      </p>
    </div>
  )
}

/** Renders the address as a QR code, or nothing if it cannot be generated. */
function AddressQr({ value }: { value: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    setDataUrl(null)
    setFailed(false)

    import('qrcode')
      .then((module) =>
        module.default.toDataURL(value, {
          width: 480,
          margin: 1,
          // High error correction: a QR read off a phone screen at an angle
          // still has to resolve to exactly the right string.
          errorCorrectionLevel: 'H',
          color: { dark: '#000000', light: '#ffffff' },
        }),
      )
      .then((url) => {
        if (active) setDataUrl(url)
      })
      .catch(() => {
        if (active) setFailed(true)
      })

    return () => {
      active = false
    }
  }, [value])

  if (failed) {
    return (
      <div className="flex h-[180px] w-[180px] shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line p-4 text-center">
        <QrCode className="h-5 w-5 text-muted" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-muted">
          QR unavailable. Copy the address instead.
        </p>
      </div>
    )
  }

  if (!dataUrl) {
    return <div className="h-[180px] w-[180px] shrink-0 animate-pulse rounded-xl bg-white/[0.04]" />
  }

  return (
    // A locally generated data: URL. next/image would route it through the
    // optimiser for no benefit, and the address must never leave the browser.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt="QR code of the deposit address"
      width={180}
      height={180}
      className="h-[180px] w-[180px] shrink-0 rounded-xl bg-white p-2"
    />
  )
}

export function DepositAddressPanel() {
  const [data, setData] = useState<{
    addresses: UserDepositAddress[]
    assets: AssetSummary[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    fetchMyDepositAddresses()
      .then((response) => {
        if (!active) return
        setData({ addresses: response.addresses, assets: response.assets })
        setSelected((current) => current ?? response.addresses[0]?.assetId ?? null)
      })
      .catch((cause: unknown) => {
        if (!active) return
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not load your deposit details. Do not send funds until this screen loads.',
        )
      })

    return () => {
      active = false
    }
  }, [])

  const assetById = useMemo(
    () => new Map((data?.assets ?? []).map((asset) => [asset.id, asset])),
    [data],
  )

  const active = useMemo(
    () => data?.addresses.find((entry) => entry.assetId === selected) ?? null,
    [data, selected],
  )

  if (error) {
    return (
      <Card className="border-negative/30 bg-negative/[0.05]">
        <CardBody className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-negative" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-negative">Deposit details unavailable</p>
            <p className="mt-1 text-sm leading-relaxed text-white/75">{error}</p>
            <p className="mt-2 text-sm leading-relaxed text-white/75">
              Do not send funds to an address from an email, a chat message or an older screenshot.
              Every deposit address must come from this screen.
            </p>
          </div>
        </CardBody>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardBody>
          <SkeletonRows rows={4} />
        </CardBody>
      </Card>
    )
  }

  if (data.addresses.length === 0) {
    return (
      <Card>
        <CardBody className="p-0">
          <EmptyState
            icon={<QrCode className="h-5 w-5" />}
            title="No deposit address yet"
            description="Your account has not been issued a deposit address. This is done manually after verification — contact support if it has been more than one business day. Until one appears here, there is nowhere for you to send funds."
            className="border-0"
          />
        </CardBody>
      </Card>
    )
  }

  const asset = active ? assetById.get(active.assetId) : undefined
  const symbol = asset?.symbol ?? active?.assetId.toUpperCase() ?? ''

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-col items-start gap-4 sm:flex-row sm:items-center">
          <CardTitle>Deposit address</CardTitle>
          <div className="w-full sm:ml-auto sm:w-56">
            <Select
              aria-label="Choose an asset to deposit"
              value={selected ?? ''}
              onChange={(event) => setSelected(event.target.value)}
              options={data.addresses.map((entry) => ({
                value: entry.assetId,
                label: `${assetById.get(entry.assetId)?.symbol ?? entry.assetId.toUpperCase()} · ${entry.networkLabel}`,
              }))}
            />
          </div>
        </CardHeader>

        {active && (
          <CardBody className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <AssetIcon symbol={symbol} color={asset?.color ?? '#8C9188'} size="sm" />
              <span className="text-sm font-medium text-white">
                {asset?.name ?? symbol} ({symbol})
              </span>
              <Badge tone="accent">{active.networkLabel}</Badge>
            </div>

            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <AddressQr value={active.address} />

              <div className="min-w-0 flex-1 space-y-5">
                <CopyField label={`${symbol} address · ${active.networkLabel}`} value={active.address} />

                {active.addressTag && (
                  <CopyField
                    label={`${active.tagLabel ?? 'Memo'} — required`}
                    value={active.addressTag}
                    emphasis
                  />
                )}
              </div>
            </div>

            {active.addressTag && (
              <div className="flex items-start gap-3 rounded-xl border border-warn/30 bg-warn/[0.06] p-4">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
                <p className="text-sm leading-relaxed text-white/80">
                  <span className="font-medium text-warn">
                    The {active.tagLabel?.toLowerCase() ?? 'memo'} is not optional.
                  </span>{' '}
                  It is how your transfer is identified as yours. A deposit sent without it, or
                  with the wrong one, arrives unattributed and recovering it is slow and not
                  guaranteed.
                </p>
              </div>
            )}

            <ul className="space-y-2.5 text-sm text-muted">
              {[
                `Send only ${symbol}, and only over ${active.networkLabel}. Another asset or another network sent here is lost permanently.`,
                'Check the address on this screen before every deposit. Do not reuse a saved copy — compare the first and last characters against your wallet before confirming.',
                'Deposits credit after the required network confirmations, not on send.',
              ].map((point) => (
                <li key={point} className="flex gap-2.5">
                  <span
                    className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent"
                    aria-hidden="true"
                  />
                  <span className="leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        )}
      </Card>

      {data.assets.length > data.addresses.length && (
        <Card>
          <CardBody className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-white/75">
              No address has been issued for{' '}
              {data.assets
                .filter((entry) => !data.addresses.some((row) => row.assetId === entry.id))
                .map((entry) => entry.symbol)
                .join(', ')}
              . Contact support to have one assigned — there is no address to send those to yet.
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
