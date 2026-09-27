'use client'

import { AssetIcon, ChangePill } from '@/components/ui/asset-icon'
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
import type { Holding } from '@/lib/types'
import { formatAmount, formatCurrency } from '@/lib/utils'

/**
 * Holdings list.
 *
 * Renders as a table from `sm` up and as stacked cards below it — a six-column
 * financial table cannot be made usable at 360px by scrolling alone.
 */
export function HoldingsTable({ holdings }: { holdings: Holding[] }) {
  return (
    <>
      <TableWrap className="hidden sm:block">
        <Table>
          <Thead>
            <Tr>
              <Th>Asset</Th>
              <Th numeric>Price</Th>
              <Th numeric>Holdings</Th>
              <Th numeric>Value</Th>
              <Th numeric>24h</Th>
            </Tr>
          </Thead>
          <Tbody>
            {holdings.map((holding) => (
              <Tr key={holding.assetId} interactive>
                <Td>
                  <div className="flex items-center gap-3">
                    <AssetIcon
                      symbol={holding.symbol}
                      color={getAsset(holding.assetId)?.color ?? '#8C9188'}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">{holding.name}</p>
                      <p className="text-xs text-muted">{holding.symbol}</p>
                    </div>
                  </div>
                </Td>
                <Td numeric>{formatCurrency(holding.price)}</Td>
                <Td numeric>
                  {formatAmount(holding.amount)}{' '}
                  <span className="text-muted">{holding.symbol}</span>
                </Td>
                <Td numeric className="font-medium">
                  {formatCurrency(holding.value)}
                </Td>
                <Td numeric>
                  <ChangePill value={holding.changePercent24h} />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableWrap>

      <MobileCardList className="sm:hidden">
        {holdings.map((holding) => (
          <MobileCard key={holding.assetId}>
            <div className="flex items-center gap-3">
              <AssetIcon
                symbol={holding.symbol}
                color={getAsset(holding.assetId)?.color ?? '#8C9188'}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{holding.name}</p>
                <p className="text-xs text-muted">{holding.symbol}</p>
              </div>
              <ChangePill value={holding.changePercent24h} />
            </div>

            <div className="mt-3 divide-y divide-line border-t border-line pt-1">
              <MobileRow label="Price" value={<span className="num">{formatCurrency(holding.price)}</span>} />
              <MobileRow
                label="Holdings"
                value={
                  <span className="num">
                    {formatAmount(holding.amount)} {holding.symbol}
                  </span>
                }
              />
              <MobileRow
                label="Value"
                value={
                  <span className="num font-medium text-white">
                    {formatCurrency(holding.value)}
                  </span>
                }
              />
              <MobileRow
                label="Allocation"
                value={<span className="num">{holding.allocation}%</span>}
              />
            </div>
          </MobileCard>
        ))}
      </MobileCardList>
    </>
  )
}
