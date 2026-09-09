import { memo, useState } from 'react'
import { updateTransactionStatus } from '../api/transactionsApi'
import type { Transaction } from '../types/transaction'
import { StatusBadge } from './StatusBadge'
import './TransactionTable.css'

// Renders at most this many rows even though the full retained set (up to the
// backend's 1000-item cap) stays in state for filtering — docs/DESIGN.md §16.
const MAX_VISIBLE_ROWS = 200

const TransactionRow = memo(function TransactionRow({ transaction }: { transaction: Transaction }) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateFailed, setUpdateFailed] = useState(false)

  // Only Pending has anywhere left to go (docs/DESIGN.md §10) — Completed and
  // Failed are terminal states, so no actions render for them at all rather
  // than rendering disabled/no-op buttons.
  async function handleStatusChange(newStatus: 'Completed' | 'Failed') {
    setIsUpdating(true)
    setUpdateFailed(false)
    try {
      // No local state mutation on success: the SignalR "TransactionUpdated"
      // broadcast this triggers is what actually updates the row, the same
      // way every other write in this app flows back through the live feed
      // rather than an optimistic local update.
      await updateTransactionStatus(transaction.transactionId, newStatus)
    } catch {
      setUpdateFailed(true)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <tr className="transaction-row">
      {/* Full id kept as a title tooltip — a raw GUID is unreadable in a
          table but is still the real id, not truncated in the data itself. */}
      <td className="transaction-table__id" title={transaction.transactionId}>
        {transaction.transactionId.slice(0, 8)}
      </td>
      <td>
        {transaction.amount.toFixed(2)} {transaction.currency}
      </td>
      <td>
        <StatusBadge status={transaction.status} />
      </td>
      <td className="transaction-table__timestamp">{new Date(transaction.timestamp).toLocaleString()}</td>
      <td className="transaction-table__actions">
        {transaction.status === 'Pending' ? (
          <>
            <button
              type="button"
              className="transaction-table__action"
              disabled={isUpdating}
              onClick={() => handleStatusChange('Completed')}
            >
              Complete
            </button>
            <button
              type="button"
              className="transaction-table__action transaction-table__action--danger"
              disabled={isUpdating}
              onClick={() => handleStatusChange('Failed')}
            >
              Fail
            </button>
            {updateFailed && (
              <span className="transaction-table__action-error" role="alert">
                Update failed
              </span>
            )}
          </>
        ) : (
          <span className="transaction-table__no-actions">—</span>
        )}
      </td>
    </tr>
  )
})

export function TransactionTable({ transactions }: { transactions: Transaction[] }) {
  const visible = transactions.slice(0, MAX_VISIBLE_ROWS)
  const isClipped = transactions.length > MAX_VISIBLE_ROWS

  return (
    <div className="transaction-table-wrapper">
      {isClipped && (
        <p className="transaction-table__count" role="status">
          Showing {MAX_VISIBLE_ROWS} of {transactions.length}
        </p>
      )}
      <table className="transaction-table">
        <thead>
          <tr>
            <th>Transaction ID</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Timestamp</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr>
              <td className="transaction-table__empty" colSpan={5}>
                No transactions yet.
              </td>
            </tr>
          ) : (
            visible.map((transaction) => <TransactionRow key={transaction.transactionId} transaction={transaction} />)
          )}
        </tbody>
      </table>
    </div>
  )
}
