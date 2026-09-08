import { memo } from 'react'
import type { Transaction } from '../types/transaction'
import { StatusBadge } from './StatusBadge'

// Renders at most this many rows even though the full retained set (up to the
// backend's 1000-item cap) stays in state for filtering — docs/DESIGN.md §16.
const MAX_VISIBLE_ROWS = 200

const TransactionRow = memo(function TransactionRow({ transaction }: { transaction: Transaction }) {
  return (
    <tr>
      <td>{transaction.transactionId}</td>
      <td>
        {transaction.amount.toFixed(2)} {transaction.currency}
      </td>
      <td>
        <StatusBadge status={transaction.status} />
      </td>
      <td>{new Date(transaction.timestamp).toLocaleString()}</td>
    </tr>
  )
})

export function TransactionTable({ transactions }: { transactions: Transaction[] }) {
  const visible = transactions.slice(0, MAX_VISIBLE_ROWS)

  return (
    <table>
      <thead>
        <tr>
          <th>Transaction ID</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Timestamp</th>
        </tr>
      </thead>
      <tbody>
        {visible.map((transaction) => (
          <TransactionRow key={transaction.transactionId} transaction={transaction} />
        ))}
      </tbody>
    </table>
  )
}
