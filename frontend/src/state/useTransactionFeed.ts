import { useEffect, useMemo, useState } from 'react'
import { getTransactionsSnapshot } from '../api/transactionsApi'
import { useTransactionHub } from '../realtime/hubConnection'
import type { Transaction } from '../types/transaction'
import { filterTransactions, type StatusFilter } from './filterTransactions'
import { useBatchedUpdates } from './useBatchedUpdates'

function mergeByIdNewestFirst(previous: Transaction[], batch: Transaction[]): Transaction[] {
  // No upsert on the backend (docs/DESIGN.md §10), but a repeated
  // transactionId is handled defensively here too — replaces in place rather
  // than duplicating a row.
  const byId = new Map(previous.map((t) => [t.transactionId, t]))
  for (const t of batch) byId.set(t.transactionId, t)
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )
}

/**
 * The single state-owning hook for /monitor (docs/DESIGN.md §14, §15):
 * snapshot fetch on mount, live SignalR subscription (buffered via
 * useBatchedUpdates), and client-side filtering.
 */
export function useTransactionFeed() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const { items: transactions, enqueue, seed } = useBatchedUpdates<Transaction>(mergeByIdNewestFirst)

  useEffect(() => {
    let cancelled = false
    getTransactionsSnapshot()
      .then((snapshot) => {
        if (!cancelled) seed(snapshot)
      })
      .catch(() => {
        // Snapshot failure just means starting empty; live updates still work
        // once the hub connects.
      })
    return () => {
      cancelled = true
    }
  }, [seed])

  const connectionStatus = useTransactionHub(enqueue)

  const filtered = useMemo(
    () => filterTransactions(transactions, statusFilter),
    [transactions, statusFilter],
  )

  return { transactions: filtered, statusFilter, setStatusFilter, connectionStatus }
}
