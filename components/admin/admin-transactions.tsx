'use client'

import { useEffect, useState } from 'react'
import { Receipt } from 'lucide-react'
import { AssetIcon } from '@/components/ui/asset-icon'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Select } from '@/components/ui/select'
import { SkeletonRows } from '@/components/ui/skeleton'
import {
  MobileCard,
  MobileCardList,
  MobileRow,
  Table,
  TableWrap,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { listTransactions } from '@/lib/api/transactions'
import { getAsset } from '@/lib/mock-data'
import type { Transaction, TransactionStatus, TransactionType } from '@/lib/types'
import { formatAmount, formatCurrency, formatDate } from '@/lib/utils'

const statusOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
]

/**
 * Shared admin ledger view.
 *
 * Used by the Transactions, Deposits and Withdrawals screens — the same list,
 * scoped to a type. The action buttons are inert: approving or reversing a
 * transaction must be a server-side operation with an audit trail.
 */
export function AdminTransactions({
  type,
  title,
  showApproval = false,
}: {
  type?: TransactionType
  title: string
  showApproval?: boolean
}) {
  const { toast } = useToast()
  const [status, setStatus] = useState<TransactionStatus | 'all'>('all')
  const [items, setItems] = useState<Transaction[] | null>(null)

  useEffect(() => {
    let active = true
    setItems(null)
    listTransactions({ type: type ?? 'all', status, pageSize: 50 }).then(({ data }) => {
      if (active) setItems(data.items)
    })
    return () => {
      active = false
    }
  }, [type, status])

  function notifyReadOnly() {
    toast({
      tone: 'warn',
      title: 'Action not available',
      description:
        'Approvals and reversals need a server-side ledger with an audit trail. Nothing is wired up in this build.',
    })
  }

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-4 sm:flex-row sm:items-center">
        <CardTitle>{title}</CardTitle>
        <div className="w-full sm:ml-auto sm:w-44">
          <Select
            aria-label="Filter by status"
            options={statusOptions}
            value={status}
            onChange={(e) => setStatus(e.target.value as TransactionStatus | 'all')}
          />
        </div>
      </CardHeader>

      <CardBody className="p-4 sm:p-0">
        {!items ? (
          <div className="p-1 sm:p-5">
            <SkeletonRows rows={6} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-5 w-5" />}
            title="No records"
            description="Nothing matches the current filter."
            className="border-0"
          />
        ) : (
          <>
            <TableWrap className="hidden sm:block">
              <Table className="min-w-[760px]">
                <Thead>
                  <Tr>
                    <Th>Date</Th>
                    <Th>Reference</Th>
                    <Th>Type</Th>
                    <Th>Asset</Th>
                    <Th numeric>Amount</Th>
                    <Th numeric>Value</Th>
                    <Th>Status</Th>
                    {showApproval && <Th numeric>Actions</Th>}
                  </Tr>
                </Thead>
                <Tbody>
                  {items.map((tx) => (
                    <Tr key={tx.id} interactive>
                      <Td className="text-muted">{formatDate(tx.date)}</Td>
                      <Td className="num text-muted">{tx.id}</Td>
                      <Td className="capitalize">{tx.type}</Td>
                      <Td>
                        <span className="flex items-center gap-2.5">
                          <AssetIcon
                            symbol={tx.symbol}
                            color={getAsset(tx.assetId)?.color ?? '#8C9188'}
                            size="sm"
                          />
                          {tx.symbol}
                        </span>
                      </Td>
                      <Td numeric>{formatAmount(tx.amount)}</Td>
                      <Td numeric>{formatCurrency(tx.usdValue)}</Td>
                      <Td>
                        <StatusBadge status={tx.status} />
                      </Td>
                      {showApproval && (
                        <Td numeric>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={notifyReadOnly}
                            disabled={tx.status !== 'pending'}
                          >
                            Review
                          </Button>
                        </Td>
                      )}
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableWrap>

            <MobileCardList className="sm:hidden">
              {items.map((tx) => (
                <MobileCard key={tx.id}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium capitalize text-white">
                      {tx.type} · {tx.symbol}
                    </p>
                    <StatusBadge status={tx.status} />
                  </div>
                  <div className="mt-3 divide-y divide-line border-t border-line pt-1">
                    <MobileRow label="Reference" value={<span className="num">{tx.id}</span>} />
                    <MobileRow label="Date" value={formatDate(tx.date)} />
                    <MobileRow
                      label="Amount"
                      value={
                        <span className="num">
                          {formatAmount(tx.amount)} {tx.symbol}
                        </span>
                      }
                    />
                    <MobileRow
                      label="Value"
                      value={<span className="num">{formatCurrency(tx.usdValue)}</span>}
                    />
                  </div>
                </MobileCard>
              ))}
            </MobileCardList>
          </>
        )}
      </CardBody>
    </Card>
  )
}
