/** Transaction history service. */

import { platform } from '../config'
import { demoTransactions } from '../mock-data'
import type {
  ApiResult,
  Paginated,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../types'
import { request, withCapability, withFallback } from './client'

export interface TransactionFilters {
  type?: TransactionType | 'all'
  status?: TransactionStatus | 'all'
  search?: string
  page?: number
  pageSize?: number
}

export async function listTransactions(
  filters: TransactionFilters = {},
): Promise<ApiResult<Paginated<Transaction>>> {
  const { type = 'all', status = 'all', search = '', page = 1, pageSize = 10 } = filters

  return withCapability(
    platform.custodyEnabled,
    () =>
      request<Paginated<Transaction>>('/transactions', {
        query: { type, status, search, page, pageSize },
      }),
    // No ledger yet, so a real account genuinely has no transaction history.
    () => ({ items: [], page, pageSize, total: 0 }),
    () => {
      const term = search.trim().toLowerCase()
      const filtered = demoTransactions.filter((tx) => {
        if (type !== 'all' && tx.type !== type) return false
        if (status !== 'all' && tx.status !== status) return false
        if (term) {
          const haystack = `${tx.symbol} ${tx.type} ${tx.description ?? ''}`.toLowerCase()
          if (!haystack.includes(term)) return false
        }
        return true
      })

      const start = (page - 1) * pageSize
      return {
        items: filtered.slice(start, start + pageSize),
        page,
        pageSize,
        total: filtered.length,
      }
    },
  )
}

export async function fetchTransaction(id: string): Promise<ApiResult<Transaction | undefined>> {
  return withFallback(
    () => request<Transaction>(`/transactions/${id}`),
    () => demoTransactions.find((t) => t.id === id),
    150,
  )
}
