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

  // Parse each timestamp once up front rather than inside the comparator —
  // this runs on every animation-frame flush (docs/DESIGN.md §16), so an
  // O(n log n) sort otherwise re-parses each element's Date O(log n) times.
  return Array.from(byId.values(), (t) => [Date.parse(t.timestamp), t] as const)
    .sort((a, b) => b[0] - a[0])
    .map(([, t]) => t)
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
