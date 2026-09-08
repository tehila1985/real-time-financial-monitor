// Mirrors the backend's Transaction record 1:1 (backend/src/Backend/Models/Transaction.cs)
// — no separate frontend view model, same reasoning as docs/DESIGN.md §9.

export type TransactionStatus = 'Pending' | 'Completed' | 'Failed'

// Single source of truth for the runtime values — previously copy-pasted
// separately into TransactionForm, TransactionGenerator, and FilterBar.
export const TRANSACTION_STATUSES: readonly TransactionStatus[] = ['Pending', 'Completed', 'Failed']

export interface Transaction {
  transactionId: string
  amount: number
  currency: string
  status: TransactionStatus
  timestamp: string // ISO 8601, as sent by the backend
}
