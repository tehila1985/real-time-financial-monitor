import type { Transaction, TransactionStatus } from '../types/transaction'

export type StatusFilter = 'All' | TransactionStatus

/** Pure function — client-side filtering (docs/DESIGN.md FR7), no network call. */
export function filterTransactions(transactions: Transaction[], filter: StatusFilter): Transaction[] {
  if (filter === 'All') return transactions
  return transactions.filter((t) => t.status === filter)
}
