import type { ConnectionState } from '../realtime/hubConnection'

const LABELS: Record<ConnectionState, string> = {
  connecting: 'Connecting…',
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
  disconnected: 'Disconnected',
}

// Matches StatusBadge's color logic (docs/DESIGN.md §14) — amber while
// unsettled, green when live, red when it's actually down.
const COLORS: Record<ConnectionState, string> = {
  connecting: '#d97706',
  connected: '#16a34a',
  reconnecting: '#d97706',
  disconnected: '#dc2626',
}

export function ConnectionStatus({ status }: { status: ConnectionState }) {
  return (
    <p className="connection-status" style={{ color: COLORS[status] }} aria-live="polite">
      <span className="connection-status__dot" />
      {LABELS[status]}
    </p>
  )
}
