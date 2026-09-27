'use client'

import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Repeat,
  type LucideIcon,
} from 'lucide-react'
import { AssetIcon } from '@/components/ui/asset-icon'
import { StatusBadge } from '@/components/ui/badge'
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
import { getAsset } from '@/lib/mock-data'
import type { Transaction, TransactionType } from '@/lib/types'
import { formatAmount, formatCurrency, formatDate } from '@/lib/utils'

const typeIcon: Record<TransactionType, LucideIcon> = {
  deposit: ArrowDownLeft,
  withdrawal: ArrowUpRight,
  trade: ArrowLeftRight,
  transfer: Repeat,
}

const typeTone: Record<TransactionType, string> = {
  deposit: 'text-positive',
  withdrawal: 'text-negative',
  trade: 'text-accent',
  transfer: 'text-sky-300',
}

export function TransactionsTable({ transactions }: { transactions: Transaction[] }) {
  return (
    <>
      <TableWrap className="hidden sm:block">
        <Table>
          <Thead>
            <Tr>
              <Th>Date</Th>
              <Th>Type</Th>
              <Th>Asset</Th>
              <Th numeric>Amount</Th>
              <Th numeric>Value</Th>
              <Th>Status</Th>
            </Tr>
          </Thead>
          <Tbody>
            {transactions.map((tx) => {
              const Icon = typeIcon[tx.type]
              return (
                <Tr key={tx.id} interactive>
                  <Td className="text-muted">{formatDate(tx.date)}</Td>
                  <Td>
                    <span className="flex items-center gap-2">
                      <Icon className={`h-3.5 w-3.5 ${typeTone[tx.type]}`} aria-hidden="true" />
                      <span className="capitalize">{tx.type}</span>
                    </span>
                  </Td>
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
                </Tr>
              )
            })}
          </Tbody>
        </Table>
      </TableWrap>

      <MobileCardList className="sm:hidden">
        {transactions.map((tx) => {
          const Icon = typeIcon[tx.type]
          return (
            <MobileCard key={tx.id}>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-white/[0.03]">
                  <Icon className={`h-4 w-4 ${typeTone[tx.type]}`} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium capitalize text-white">
                    {tx.type} · {tx.symbol}
                  </p>
                  <p className="text-xs text-muted">{formatDate(tx.date)}</p>
                </div>
                <StatusBadge status={tx.status} />
              </div>

              <div className="mt-3 divide-y divide-line border-t border-line pt-1">
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
                {tx.description && <MobileRow label="Detail" value={tx.description} />}
              </div>
            </MobileCard>
          )
        })}
      </MobileCardList>
    </>
  )
}
