// Mirrors the backend's Transaction record 1:1 (backend/src/Backend/Models/Transaction.cs)
// — no separate frontend view model, same reasoning as docs/DESIGN.md §9.

export type TransactionStatus = 'Pending' | 'Completed' | 'Failed'

// Single source of truth for the runtime values — previously copy-pasted
// separately into TransactionForm, TransactionGenerator, and FilterBar.
export const TRANSACTION_STATUSES: readonly TransactionStatus[] = ['Pending', 'Completed', 'Failed']

// `readonly` on every field — the C# side is immutable (`sealed record` with
// `init`-only properties, Backend/Models/Transaction.cs); this mirror should
// enforce the same thing, not just happen to never be mutated (found in a
// code-review pass comparing the two sides for immutability parity).
export interface Transaction {
  readonly transactionId: string
  readonly amount: number
  readonly currency: string
  readonly status: TransactionStatus
  readonly timestamp: string // ISO 8601, as sent by the backend
}
