import { useEffect, useMemo, useState } from 'react'
import { getTransactionsSnapshot } from '../api/transactionsApi'
import { useTransactionHub } from '../realtime/hubConnection'
import type { Transaction } from '../types/transaction'
import { filterTransactions, type StatusFilter } from './filterTransactions'
import { useBatchedUpdates } from './useBatchedUpdates'

// Mirrors the backend's default Storage:RetentionCap (docs/DESIGN.md §13).
// Without this, the frontend's own copy of the feed grows without bound for
// as long as the tab stays open — the backend evicts old entries, but merging
// live updates into local state never did. That's also what caused a real
// UX inconsistency: refreshing after a long session showed fewer transactions
// (the backend's capped 1000) than were visible a moment before (this array,
// uncapped) — found in code review, not by design.
const MAX_RETAINED_TRANSACTIONS = 1000

export function mergeByIdNewestFirst(previous: Transaction[], batch: Transaction[]): Transaction[] {
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
    .slice(0, MAX_RETAINED_TRANSACTIONS)
    .map(([, t]) => t)
}

/**
 * The single state-owning hook for /monitor (docs/DESIGN.md §14, §15):
 * snapshot fetch on mount, live SignalR subscription (buffered via
 * useBatchedUpdates), and client-side filtering.
 */
export function useTransactionFeed() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [snapshotError, setSnapshotError] = useState(false)
  const { items: transactions, enqueue, seed } = useBatchedUpdates<Transaction>(mergeByIdNewestFirst)

  useEffect(() => {
    let cancelled = false
    getTransactionsSnapshot()
      .then((snapshot) => {
        if (!cancelled) seed(snapshot)
      })
      .catch(() => {
        // Live updates still work once the hub connects even if this fails —
        // but the dashboard should say so rather than looking identical to a
        // genuinely empty backend (found in code review: this was silent).
        if (!cancelled) setSnapshotError(true)
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

  return { transactions: filtered, statusFilter, setStatusFilter, connectionStatus, snapshotError }
}
