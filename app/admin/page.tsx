'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  LifeBuoy,
  ShieldAlert,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react'
import { AdminShell } from '@/components/admin/admin-shell'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table'
import { fetchAdminOverview, type AdminOverviewData } from '@/lib/api/admin'
import { formatDate, formatNumber } from '@/lib/utils'

/**
 * Admin overview — a work queue.
 *
 * This page previously rendered invented user counts and a mock volume chart
 * from two endpoints that were never written, so opening it in production threw
 * a 500. Every figure now comes from the database.
 *
 * It is ordered by what costs somebody something if it is missed, not by what
 * looks impressive. A recorded-but-uncredited deposit is a customer whose money
 * arrived and whose balance still reads zero; that belongs above a user count.
 */

interface QueueItem {
  label: string
  count: number
  href: string
  hint: string
  icon: React.ReactNode
  /** Money is already owed or already arrived — not merely waiting. */
  urgent?: boolean
}

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback
}

function trimZeros(value: string): string {
  return value.includes('.') ? value.replace(/\.?0+$/, '') : value
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverviewData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setData(await fetchAdminOverview())
      setError(null)
    } catch (cause) {
      setError(errorMessage(cause, 'Could not load the overview.'))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const queue: QueueItem[] = data
    ? [
        {
          label: 'Deposits ready to credit',
          count: data.queue.creditableDeposits,
          href: '/admin/deposits',
          hint: 'Confirmed on-chain. Until credited, the customer’s balance reads zero.',
          icon: <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />,
          urgent: true,
        },
        {
          label: 'Investments due for payout',
          count: data.queue.maturedInvestments,
          href: '/admin/investments',
          hint: 'Term elapsed. This is a debt already overdue.',
          icon: <TrendingUp className="h-4 w-4" aria-hidden="true" />,
          urgent: true,
        },
        {
          label: 'Withdrawals approved, not yet paid',
          count: data.queue.approvedUnpaid,
          href: '/admin/withdrawals',
          hint: 'Cleared for payment. Somebody has to send the money.',
          icon: <ArrowUpFromLine className="h-4 w-4" aria-hidden="true" />,
          urgent: true,
        },
        {
          label: 'Withdrawals awaiting approval',
          count: data.queue.pendingWithdrawals,
          href: '/admin/withdrawals',
          hint: 'Funds are locked while these wait.',
          icon: <ArrowUpFromLine className="h-4 w-4" aria-hidden="true" />,
        },
        {
          label: 'Deposits awaiting confirmations',
          count: data.queue.pendingDeposits - data.queue.creditableDeposits,
          href: '/admin/deposits',
          hint: 'Recorded but below the confirmation threshold.',
          icon: <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />,
        },
        {
          label: 'Verification decisions',
          count: data.queue.awaitingKyc,
          href: '/admin/users',
          hint: 'None of these accounts can deposit until approved.',
          icon: <UserCheck className="h-4 w-4" aria-hidden="true" />,
        },
        {
          label: 'Support tickets needing a reply',
          count: data.queue.awaitingSupport,
          href: '/admin/support',
          hint: 'Oldest first on the support screen.',
          icon: <LifeBuoy className="h-4 w-4" aria-hidden="true" />,
        },
      ].filter((item) => item.count > 0)
    : []

  return (
    <AdminShell data="live" title="Overview" description="What needs attention, and platform totals">
      <div className="space-y-6">
        {error && (
          <Card className="border-negative/30 bg-negative/[0.05]">
            <CardBody className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-negative" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-negative">Could not load the overview</p>
                <p className="mt-1 text-sm leading-relaxed text-white/75">{error}</p>
                <Button variant="secondary" size="sm" className="mt-3" onClick={() => void load()}>
                  Try again
                </Button>
              </div>
            </CardBody>
          </Card>
        )}

        {/* ---------- Integrity alarms, above everything ---------- */}
        {data && !data.ledger.balanced && (
          <Card className="border-negative/40 bg-negative/[0.08]">
            <CardBody className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-negative" aria-hidden="true" />
              <div className="text-sm leading-relaxed text-white/85">
                <p className="font-semibold text-negative">The ledger does not balance</p>
                <p className="mt-1.5">
                  Entries were written outside <code>postTransaction</code>, so the books no longer
                  add up. Stop crediting and paying until this is understood — every figure below
                  is suspect. Imbalance per asset:
                </p>
                <ul className="num mt-2 space-y-1">
                  {data.ledger.imbalances.map((entry) => (
                    <li key={entry.assetId}>
                      {entry.assetId.toUpperCase()}: {entry.imbalance}
                    </li>
                  ))}
                </ul>
              </div>
            </CardBody>
          </Card>
        )}

        {data && !data.treasury.solvent && (
          <Card className="border-negative/40 bg-negative/[0.06]">
            <CardBody className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-negative" aria-hidden="true" />
              <div className="text-sm leading-relaxed text-white/85">
                <p className="font-semibold text-negative">
                  You have promised more than the treasury holds
                </p>
                <p className="mt-1.5">
                  The shortfall exists now and will surface as a refused maturity on a date those
                  contracts already fix.{' '}
                  <Link href="/admin/investments" className="text-accent underline">
                    Fund the treasury
                  </Link>
                  .
                </p>
                <ul className="num mt-2 space-y-1">
                  {data.treasury.positions
                    .filter((position) => !position.funded)
                    .map((position) => (
                      <li key={position.assetId}>
                        {position.symbol}: holds {trimZeros(position.balance)}, owes{' '}
                        {trimZeros(position.committed)}
                      </li>
                    ))}
                </ul>
              </div>
            </CardBody>
          </Card>
        )}

        {/* ---------- The queue ---------- */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Needs attention</CardTitle>
              <p className="mt-1 text-sm text-muted">
                Ordered by what costs someone something if it is missed
              </p>
            </div>
          </CardHeader>
          <CardBody>
            {!data ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : queue.length === 0 ? (
              <div className="flex items-start gap-3 rounded-xl border border-positive/25 bg-positive/[0.05] p-4">
                <CheckCircle2
                  className="mt-0.5 h-5 w-5 shrink-0 text-positive"
                  aria-hidden="true"
                />
                <div className="text-sm leading-relaxed text-white/80">
                  <p className="font-medium text-positive">Nothing is waiting</p>
                  <p className="mt-1">
                    No deposits to credit, no withdrawals to pay, no verifications or tickets
                    outstanding.
                  </p>
                </div>
              </div>
            ) : (
              <ul className="space-y-3">
                {queue.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className={
                        item.urgent
                          ? 'flex items-start gap-3.5 rounded-xl border border-warn/30 bg-warn/[0.05] p-4 transition-colors hover:border-warn/50'
                          : 'flex items-start gap-3.5 rounded-xl border border-line bg-base-800 p-4 transition-colors hover:border-accent/30'
                      }
                    >
                      <span
                        className={
                          item.urgent
                            ? 'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warn/12 text-warn'
                            : 'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-muted'
                        }
                      >
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className="num text-xl font-semibold text-white">
                            {item.count}
                          </span>
                          <span className="text-sm font-medium text-white/90">{item.label}</span>
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                          {item.hint}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* ---------- Totals ---------- */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {!data
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[104px]" />)
            : [
                {
                  label: 'Customers',
                  value: formatNumber(data.totals.users),
                  hint: `${data.totals.verifiedUsers} verified · ${data.totals.newUsers7d} new this week`,
                  icon: <Users className="h-4 w-4" aria-hidden="true" />,
                },
                {
                  label: 'Active investments',
                  value: formatNumber(data.totals.activeInvestments),
                  hint: 'Contracts with funds locked',
                  icon: <TrendingUp className="h-4 w-4" aria-hidden="true" />,
                },
                {
                  label: 'Published plans',
                  value: formatNumber(data.totals.publishedPlans),
                  hint: `${data.totals.draftPlans} draft${data.totals.draftPlans === 1 ? '' : 's'} not public`,
                  icon: <LifeBuoy className="h-4 w-4" aria-hidden="true" />,
                },
                {
                  label: 'Receiving addresses',
                  value: formatNumber(data.totals.activeReceivingAddresses),
                  hint:
                    data.totals.activeReceivingAddresses === 0
                      ? 'None recorded — nobody can deposit'
                      : 'Active in the pool',
                  icon: <Wallet className="h-4 w-4" aria-hidden="true" />,
                },
              ].map((stat) => (
                <Card key={stat.label}>
                  <CardBody>
                    <div className="flex items-center gap-2 text-muted">
                      {stat.icon}
                      <span className="text-xs uppercase tracking-wider">{stat.label}</span>
                    </div>
                    <p className="num mt-2 text-2xl font-semibold text-white">{stat.value}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{stat.hint}</p>
                  </CardBody>
                </Card>
              ))}
        </div>

        {/* ---------- Treasury ---------- */}
        {data && data.treasury.positions.length > 0 && (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Treasury</CardTitle>
                <p className="mt-1 text-sm text-muted">
                  Funds held against promised investment returns
                </p>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              <TableWrap>
                <Table className="min-w-[520px]">
                  <Thead>
                    <Tr>
                      <Th>Asset</Th>
                      <Th numeric>Held</Th>
                      <Th numeric>Owed</Th>
                      <Th numeric>Surplus</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {data.treasury.positions.map((position) => (
                      <Tr key={position.assetId}>
                        <Td className="text-white">{position.symbol}</Td>
                        <Td numeric className="num text-white">
                          {trimZeros(position.balance)}
                        </Td>
                        <Td numeric className="num text-muted">
                          {trimZeros(position.committed)}
                        </Td>
                        <Td numeric>
                          <span className={position.funded ? 'num text-positive' : 'num text-negative'}>
                            {trimZeros(position.surplus)}
                          </span>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableWrap>
            </CardBody>
          </Card>
        )}

        {/* ---------- Recent registrations ---------- */}
        <Card>
          <CardHeader>
            <CardTitle>Recent registrations</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {!data ? (
              <div className="p-5">
                <Skeleton className="h-48 w-full" />
              </div>
            ) : data.recentUsers.length === 0 ? (
              <p className="p-5 text-sm text-muted">No accounts yet.</p>
            ) : (
              <TableWrap>
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Name</Th>
                      <Th>Email</Th>
                      <Th>Verification</Th>
                      <Th>Joined</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {data.recentUsers.map((user) => (
                      <Tr key={user.id}>
                        <Td className="font-medium text-white">{user.name}</Td>
                        <Td className="text-muted">{user.email}</Td>
                        <Td>
                          <StatusBadge
                            status={
                              user.verification as 'verified' | 'unverified' | 'pending' | 'rejected'
                            }
                          />
                        </Td>
                        <Td className="text-muted">{formatDate(user.joined)}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableWrap>
            )}
          </CardBody>
        </Card>

        {/* ---------- Honest note on what is still missing ---------- */}
        <Card>
          <CardBody>
            <h2 className="text-sm font-semibold text-white">Controls not yet in place</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              Authentication, role checks on every route, and an append-only audit log of
              administrative actions are implemented. These are not:
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
              {[
                'Dual approval for withdrawals — one operator can currently approve and pay alone',
                'A per-approver release limit',
                'Sanctions and AML screening on withdrawal destinations',
                'Database-level restriction of the audit log to INSERT and SELECT',
                'IP restrictions on administrative access',
                'An error reporter — failures reach the server log and nothing else',
              ].map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span
                    className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-warn"
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </AdminShell>
  )
}
