import { memo } from 'react'
import type { Transaction } from '../types/transaction'
import { StatusBadge } from './StatusBadge'
import './TransactionTable.css'

// Renders at most this many rows even though the full retained set (up to the
// backend's 1000-item cap) stays in state for filtering — docs/DESIGN.md §16.
const MAX_VISIBLE_ROWS = 200

const TransactionRow = memo(function TransactionRow({ transaction }: { transaction: Transaction }) {
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
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr>
              <td className="transaction-table__empty" colSpan={4}>
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
