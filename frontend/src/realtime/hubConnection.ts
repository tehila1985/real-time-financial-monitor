import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { useEffect, useRef, useState } from 'react'
import type { Transaction } from '../types/transaction'

// Empty in production (same-origin, via nginx — §18); set for local dev in
// .env.development.
const HUB_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const HUB_URL = `${HUB_BASE_URL}/hubs/transactions`

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

/**
 * Wraps the SignalR client's connection lifecycle. Push-only (docs/DESIGN.md
 * §11): subscribes to the single "TransactionReceived" event and reports
 * connection state for the UI's connection indicator. Automatic reconnect is
 * enabled — a one-line addition that meaningfully improves resilience for a
 * dashboard meant to always reflect current state.
 */
export function useTransactionHub(onTransactionReceived: (transaction: Transaction) => void): ConnectionState {
  const [state, setState] = useState<ConnectionState>('connecting')

  // Keep the latest callback in a ref so the connection isn't torn down and
  // rebuilt whenever the caller passes a new inline function identity. Synced
  // in an effect (not during render) — mutating a ref while rendering is
  // unsafe even though it doesn't affect this render's output.
  const handlerRef = useRef(onTransactionReceived)
  useEffect(() => {
    handlerRef.current = onTransactionReceived
  })

  useEffect(() => {
    // Guards against a stale connection's callbacks touching state after this
    // effect has already been cleaned up — e.g. React StrictMode's dev-only
    // mount→cleanup→remount, where connection.stop() may run while start()
    // is still in flight (same pattern as useTransactionFeed's snapshot fetch).
    let cancelled = false

    const connection = new HubConnectionBuilder()
      .withUrl(HUB_URL)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build()

    connection.on('TransactionReceived', (transaction: Transaction) => {
      if (!cancelled) handlerRef.current(transaction)
    })
    connection.onreconnecting(() => {
      if (!cancelled) setState('reconnecting')
    })
    connection.onreconnected(() => {
      if (!cancelled) setState('connected')
    })
    connection.onclose(() => {
      if (!cancelled) setState('disconnected')
    })

    connection
      .start()
      .then(() => {
        if (!cancelled) setState('connected')
      })
      .catch(() => {
        if (!cancelled) setState('disconnected')
      })

    return () => {
      cancelled = true
      void connection.stop()
    }
  }, [])

  return state
}
