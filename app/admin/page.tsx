'use client'

import { useEffect, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Layers,
  Receipt,
  UserCheck,
  Users,
  UserPlus,
} from 'lucide-react'
import { VolumeBarChart } from '@/components/charts/bar-chart'
import { AdminNotice } from '@/components/admin/admin-notice'
import { AdminShell } from '@/components/admin/admin-shell'
import { StatCard } from '@/components/dashboard/stat-card'
import { StatusBadge } from '@/components/ui/badge'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table'
import { fetchAdminStats, fetchPlatformVolume, listUsers } from '@/lib/api/admin'
import type { AdminStats, AdminUserRow, PricePoint } from '@/lib/types'
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils'

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [volume, setVolume] = useState<PricePoint[] | null>(null)
  const [users, setUsers] = useState<AdminUserRow[] | null>(null)

  useEffect(() => {
    let active = true
    fetchAdminStats().then(({ data }) => active && setStats(data))
    fetchPlatformVolume().then(({ data }) => active && setVolume(data))
    listUsers().then(({ data }) => active && setUsers(data.slice(0, 6)))
    return () => {
      active = false
    }
  }, [])

  return (
    <AdminShell data="mock" title="Overview" description="Platform activity at a glance">
      <div className="space-y-6">
        <AdminNotice />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats ? (
            <>
              <StatCard
                label="Total users"
                value={formatNumber(stats.totalUsers)}
                icon={<Users className="h-4 w-4" aria-hidden="true" />}
              />
              <StatCard
                label="Active users"
                value={formatNumber(stats.activeUsers)}
                icon={<UserCheck className="h-4 w-4" aria-hidden="true" />}
                info="Signed in at least once in the last 30 days."
              />
              <StatCard
                label="Pending verification"
                value={formatNumber(stats.pendingVerification)}
                icon={<UserPlus className="h-4 w-4" aria-hidden="true" />}
              />
              <StatCard
                label="Transactions (30d)"
                value={formatNumber(stats.transactions30d)}
                icon={<Receipt className="h-4 w-4" aria-hidden="true" />}
              />
              <StatCard
                label="Deposits (30d)"
                value={formatNumber(stats.deposits30d)}
                icon={<ArrowDownToLine className="h-4 w-4" aria-hidden="true" />}
              />
              <StatCard
                label="Withdrawals (30d)"
                value={formatNumber(stats.withdrawals30d)}
                icon={<ArrowUpFromLine className="h-4 w-4" aria-hidden="true" />}
              />
              <StatCard
                label="Investment plans"
                value={formatNumber(stats.activePlans)}
                icon={<Layers className="h-4 w-4" aria-hidden="true" />}
              />
            </>
          ) : (
            Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-[126px]" />)
          )}
        </div>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Platform volume</CardTitle>
              <p className="mt-1 text-sm text-muted">Mock daily volume, last 30 days</p>
            </div>
          </CardHeader>
          <CardBody className="px-2 sm:px-4">
            {volume ? (
              <VolumeBarChart
                data={volume}
                height={280}
                ariaLabel="Mock platform trading volume per day over the last 30 days"
                valueFormatter={(v) => formatCurrency(v, { compact: true })}
              />
            ) : (
              <Skeleton className="h-[280px] w-full rounded-xl" />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent registrations</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {users ? (
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
                    {users.map((user) => (
                      <Tr key={user.id} interactive>
                        <Td className="font-medium text-white">{user.name}</Td>
                        <Td className="text-muted">{user.email}</Td>
                        <Td>
                          <StatusBadge status={user.verification} />
                        </Td>
                        <Td className="text-muted">{formatDate(user.joined)}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableWrap>
            ) : (
              <div className="p-5">
                <Skeleton className="h-48 w-full" />
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="text-sm font-semibold text-white">What a real admin panel needs</h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
              {[
                'Server-side authentication and role-based authorisation on every route and API call',
                'An append-only audit log of every administrative action, with the actor and timestamp',
                'Four-eyes approval for withdrawals, balance adjustments and plan changes',
                'Separation of duties, so the person approving is not the person requesting',
                'Rate limiting, session controls and IP restrictions for administrative access',
                'Reporting built from the real ledger, never from figures entered by hand — none of the numbers above come from one',
              ].map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span
                    className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent"
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
