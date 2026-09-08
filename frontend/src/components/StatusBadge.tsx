import type { TransactionStatus } from '../types/transaction'

const COLORS: Record<TransactionStatus, string> = {
  Pending: '#d97706', // amber
  Completed: '#16a34a', // green
  Failed: '#dc2626', // red
}

export function StatusBadge({ status }: { status: TransactionStatus }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 9999,
        color: 'white',
        backgroundColor: COLORS[status],
        fontSize: '0.85em',
      }}
    >
      {status}
    </span>
  )
}
