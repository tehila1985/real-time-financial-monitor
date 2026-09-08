import type { StatusFilter } from '../state/filterTransactions'

const OPTIONS: StatusFilter[] = ['All', 'Pending', 'Completed', 'Failed']

// "Failed" is surfaced as "Errors" to match the spec's own wording (FR7:
// "Show only Errors").
const LABELS: Record<StatusFilter, string> = {
  All: 'All',
  Pending: 'Pending',
  Completed: 'Completed',
  Failed: 'Errors',
}

export function FilterBar({
  value,
  onChange,
}: {
  value: StatusFilter
  onChange: (value: StatusFilter) => void
}) {
  return (
    <div role="group" aria-label="Filter by status">
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
        >
          {LABELS[option]}
        </button>
      ))}
    </div>
  )
}
