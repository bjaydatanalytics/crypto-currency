'use client'

import { useEffect, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, Repeat, Wallet as WalletIcon } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { StatCard } from '@/components/dashboard/stat-card'
import {
  WalletActionModal,
  type WalletAction,
} from '@/components/dashboard/wallet-action-modal'
import { AssetIcon } from '@/components/ui/asset-icon'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { DemoNotice } from '@/components/ui/demo-notice'
import { SkeletonCard } from '@/components/ui/skeleton'
import { listBalances } from '@/lib/api/wallet'
import { getAsset } from '@/lib/mock-data'
import type { WalletBalance } from '@/lib/types'
import { formatAmount, formatCurrency } from '@/lib/utils'

export default function WalletPage() {
  const [wallets, setWallets] = useState<WalletBalance[] | null>(null)
  const [modal, setModal] = useState<{ action: WalletAction; wallet: WalletBalance } | null>(null)

  useEffect(() => {
    let active = true
    listBalances().then(({ data }) => active && setWallets(data))
    return () => {
      active = false
    }
  }, [])

  const totalValue = wallets?.reduce((sum, w) => sum + w.usdValue, 0) ?? 0
  const lockedValue =
    wallets?.reduce((sum, w) => sum + (w.locked / (w.available + w.locked || 1)) * w.usdValue, 0) ??
    0

  return (
    <>
      <DashboardHeader title="Wallet" />

      <div className="space-y-6 p-4 sm:p-6">
        <DemoNotice title="No custody backend connected">
          Balances below are sample data. Deposits, withdrawals and transfers are disabled: this
          build has no custody provider, no deposit addresses and no ledger. Nothing you do on this
          screen moves value.
        </DemoNotice>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Total balance"
            value={formatCurrency(totalValue)}
            icon={<WalletIcon className="h-4 w-4" aria-hidden="true" />}
          />
          <StatCard
            label="Available"
            value={formatCurrency(totalValue - lockedValue)}
            icon={<ArrowDownToLine className="h-4 w-4" aria-hidden="true" />}
          />
          <StatCard
            label="Locked"
            value={formatCurrency(lockedValue)}
            icon={<ArrowUpFromLine className="h-4 w-4" aria-hidden="true" />}
            info="Balance reserved against open orders or pending requests."
          />
        </div>

        {!wallets ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {wallets.map((wallet) => (
              <li key={wallet.assetId}>
                <Card className="h-full">
                  <CardBody>
                    <div className="flex items-center gap-3">
                      <AssetIcon
                        symbol={wallet.symbol}
                        color={getAsset(wallet.assetId)?.color ?? '#8C9188'}
                        size="lg"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-semibold text-white">
                          {wallet.name}
                        </p>
                        <p className="truncate text-xs text-muted">{wallet.network}</p>
                      </div>
                    </div>

                    <div className="mt-5">
                      <p className="num text-2xl font-semibold tracking-tight text-white">
                        {formatAmount(wallet.available + wallet.locked)}{' '}
                        <span className="text-base text-muted">{wallet.symbol}</span>
                      </p>
                      <p className="num mt-1 text-sm text-muted">
                        {formatCurrency(wallet.usdValue)}
                      </p>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-xs">
                      <div>
                        <dt className="text-muted">Available</dt>
                        <dd className="num mt-0.5 text-white/90">
                          {formatAmount(wallet.available)}
                        </dd>
                      </div>
                      <div className="text-right">
                        <dt className="text-muted">Locked</dt>
                        <dd className="num mt-0.5 text-white/90">{formatAmount(wallet.locked)}</dd>
                      </div>
                    </dl>

                    <div className="mt-5 grid grid-cols-3 gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setModal({ action: 'deposit', wallet })}
                      >
                        <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden="true" />
                        Deposit
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setModal({ action: 'withdraw', wallet })}
                      >
                        <ArrowUpFromLine className="h-3.5 w-3.5" aria-hidden="true" />
                        Withdraw
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setModal({ action: 'transfer', wallet })}
                      >
                        <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
                        Transfer
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      <WalletActionModal
        open={modal !== null}
        action={modal?.action ?? 'deposit'}
        wallet={modal?.wallet ?? null}
        wallets={wallets ?? []}
        onClose={() => setModal(null)}
      />
    </>
  )
}
