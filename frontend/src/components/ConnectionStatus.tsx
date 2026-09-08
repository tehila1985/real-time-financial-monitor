import type { ConnectionState } from '../realtime/hubConnection'

const LABELS: Record<ConnectionState, string> = {
  connecting: 'Connecting…',
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
  disconnected: 'Disconnected',
}

export function ConnectionStatus({ status }: { status: ConnectionState }) {
  return <p aria-live="polite">{LABELS[status]}</p>
}
