'use client'

import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Plus, RefreshCw, Trash2, Wallet } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { LinkWalletDialog, NoWalletsEmptyState } from '@/components/dashboard/link-wallet'
import { StatCard } from '@/components/dashboard/stat-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { SkeletonCard } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import {
  fetchChainBalances,
  listLinkedWallets,
  unlinkWallet,
  type BalancesResponse,
  type LinkedWallet,
} from '@/lib/api/wallets'
import { formatCurrency, relativeTime } from '@/lib/utils'

/** Shortens an address for display without losing its identifying ends. */
function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export default function WalletsPage() {
  const { toast } = useToast()
  const [wallets, setWallets] = useState<LinkedWallet[] | null>(null)
  const [balances, setBalances] = useState<BalancesResponse | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const [list, bal] = await Promise.all([listLinkedWallets(), fetchChainBalances()])
    setWallets(list.data.wallets)
    setBalances(bal.data)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function refresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  async function handleUnlink(id: string, address: string) {
    try {
      await unlinkWallet(id)
      toast({
        tone: 'success',
        title: 'Wallet unlinked',
        description: `${shortAddress(address)} is no longer tracked. Your funds are untouched.`,
      })
      await load()
    } catch (error) {
      toast({
        tone: 'error',
        title: 'Could not unlink',
        description: error instanceof Error ? error.message : 'Try again.',
      })
    }
  }

  return (
    <>
      <DashboardHeader title="Wallets" />

      <div className="space-y-6 p-4 sm:p-6">
        {/* The model's defining property, stated where it matters most. */}
        <div className="flex items-start gap-3 rounded-xl border border-accent/25 bg-accent/[0.06] p-4">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <div className="min-w-0 text-sm">
            <p className="font-medium text-accent">You hold your own keys</p>
            <p className="mt-1 leading-relaxed text-white/70">
              Balances below are read directly from the blockchain. This platform cannot move
              your funds, and holds no key that could. Unlinking a wallet stops it being tracked
              and nothing else.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Total tracked"
            value={
              balances?.totalUsd === null || balances?.totalUsd === undefined
                ? '—'
                : formatCurrency(balances.totalUsd)
            }
            icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
            info={
              balances?.totalUsd === null
                ? 'Withheld because at least one wallet could not be read. A partial total would understate your holdings.'
                : 'Sum across every linked wallet, priced at the latest market rate.'
            }
          />
          <StatCard label="Linked wallets" value={String(wallets?.length ?? 0)} />
          <StatCard
            label="Custody"
            value="Self"
            info="No third party holds these assets on your behalf."
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-white">Linked wallets</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={refresh} loading={refreshing}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Link wallet
            </Button>
          </div>
        </div>

        {balances?.failures && balances.failures.length > 0 && (
          <div className="rounded-xl border border-warn/25 bg-warn/[0.07] p-4 text-sm">
            <p className="font-medium text-warn">Some wallets could not be read</p>
            <ul className="mt-2 space-y-1 text-white/70">
              {balances.failures.map((failure) => (
                <li key={`${failure.chain}-${failure.address}`} className="num text-xs">
                  {shortAddress(failure.address)} on {failure.chain} — {failure.reason}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-white/60">
              These are shown as unavailable rather than zero — a network problem is not an empty
              wallet.
            </p>
          </div>
        )}

        {!wallets ? (
          <div className="grid gap-4 md:grid-cols-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : wallets.length === 0 ? (
          <NoWalletsEmptyState onLink={() => setDialogOpen(true)} />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {wallets.map((wallet) => {
              const balance = balances?.wallets.find((b) => b.walletId === wallet.id)
              return (
                <li key={wallet.id}>
                  <Card className="h-full">
                    <CardHeader>
                      <div className="min-w-0">
                        <CardTitle>{wallet.label || 'Wallet'}</CardTitle>
                        <p className="num mt-1 truncate text-xs text-muted">{wallet.address}</p>
                      </div>
                      <Badge tone="accent" className="shrink-0 normal-case tracking-normal">
                        {wallet.chain}
                      </Badge>
                    </CardHeader>
                    <CardBody>
                      {balance ? (
                        <>
                          <p className="num text-2xl font-semibold tracking-tight text-white">
                            {Number(balance.amount).toFixed(6)}{' '}
                            <span className="text-base text-muted">{balance.symbol}</span>
                          </p>
                          <p className="num mt-1 text-sm text-muted">
                            {balance.usdValue === null
                              ? 'Not priced'
                              : formatCurrency(balance.usdValue)}
                          </p>
                          <p className="mt-3 text-[11px] text-muted">
                            Block {balance.blockNumber} · read {relativeTime(balance.readAt)}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted">Balance unavailable.</p>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-4"
                        onClick={() => handleUnlink(wallet.id, wallet.address)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Unlink
                      </Button>
                    </CardBody>
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <LinkWalletDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onLinked={load}
      />
    </>
  )
}
