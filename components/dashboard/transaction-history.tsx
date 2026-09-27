'use client'

import { useEffect, useMemo, useState } from 'react'
import { Receipt, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SkeletonRows } from '@/components/ui/skeleton'
import { Tabs } from '@/components/ui/tabs'
import { listTransactions } from '@/lib/api/transactions'
import type { Paginated, Transaction, TransactionStatus, TransactionType } from '@/lib/types'
import { TransactionsTable } from './transactions-table'

const PAGE_SIZE = 8

const statusOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
]

/**
 * Filterable transaction history.
 *
 * `fixedType` pins the view to one kind of transaction — used by the Deposits
 * and Withdrawals screens, which are the same list narrowed to one type.
 */
export function TransactionHistory({
  fixedType,
  title = 'Transaction history',
}: {
  fixedType?: TransactionType
  title?: string
}) {
  const [type, setType] = useState<TransactionType | 'all'>(fixedType ?? 'all')
  const [status, setStatus] = useState<TransactionStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<Paginated<Transaction> | null>(null)

  // Any filter change invalidates the current page
  useEffect(() => {
    setPage(1)
  }, [type, status, search])

  useEffect(() => {
    let active = true
    setResult(null)
    listTransactions({ type, status, search, page, pageSize: PAGE_SIZE }).then(({ data }) => {
      if (active) setResult(data)
    })
    return () => {
      active = false
    }
  }, [type, status, search, page])

  const totalPages = useMemo(
    () => (result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1),
    [result],
  )

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-4">
        <CardTitle>{title}</CardTitle>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <Input
              type="search"
              placeholder="Search by asset or detail"
              aria-label="Search transactions"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="h-4 w-4" />}
            />
          </div>
          <div className="sm:w-44">
            <Select
              aria-label="Filter by status"
              options={statusOptions}
              value={status}
              onChange={(e) => setStatus(e.target.value as TransactionStatus | 'all')}
            />
          </div>
        </div>

        {!fixedType && (
          <Tabs
            items={[
              { value: 'all', label: 'All' },
              { value: 'deposit', label: 'Deposits' },
              { value: 'withdrawal', label: 'Withdrawals' },
              { value: 'trade', label: 'Trades' },
              { value: 'transfer', label: 'Transfers' },
            ]}
            value={type}
            onChange={(value) => setType(value as TransactionType | 'all')}
            size="sm"
            className="w-full"
          />
        )}
      </CardHeader>

      <CardBody className="p-4 sm:p-0">
        {!result ? (
          <div className="p-1 sm:p-5">
            <SkeletonRows rows={6} />
          </div>
        ) : result.items.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-5 w-5" />}
            title="No transactions found"
            description="Nothing matches the current filters. Try clearing the search or changing the status."
            className="border-0"
          />
        ) : (
          <TransactionsTable transactions={result.items} />
        )}
      </CardBody>

      {result && result.total > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-4 border-t border-line p-4">
          <p className="text-xs text-muted">
            Page <span className="num">{result.page}</span> of{' '}
            <span className="num">{totalPages}</span> ·{' '}
            <span className="num">{result.total}</span> records
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
