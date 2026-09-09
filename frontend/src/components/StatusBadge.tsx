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
        padding: '3px 10px',
        borderRadius: 9999,
        color: 'white',
        backgroundColor: COLORS[status],
        fontSize: '0.78rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        // Bonus 5: smooth status-change transitions (e.g. Pending -> Completed
        // on a repeat POST, docs/DESIGN.md §10) — a plain CSS `transition`,
        // not a keyframe animation, since this only needs to ease a single
        // property change, not play a distinct enter/exit sequence.
        transition: 'background-color 200ms ease',
      }}
    >
      {status}
    </span>
  )
}
