import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTransactionHub } from './hubConnection'

const mockConnection = {
  on: vi.fn(),
  onreconnecting: vi.fn(),
  onreconnected: vi.fn(),
  onclose: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
}

vi.mock('@microsoft/signalr', () => ({
  // A regular `function`, not an arrow function — hubConnection.ts calls this
  // with `new`, and `new` on an arrow-function mock throws "not a constructor".
  HubConnectionBuilder: vi.fn().mockImplementation(function () {
    return {
      withUrl: vi.fn().mockReturnThis(),
      withAutomaticReconnect: vi.fn().mockReturnThis(),
      configureLogging: vi.fn().mockReturnThis(),
      build: vi.fn(() => mockConnection),
    }
  }),
  LogLevel: { Warning: 2 },
}))

// Exercises the connection-state machine directly — previously only covered
// indirectly by mocking this whole module away in other tests (found in code
// review: the state transitions themselves had zero direct coverage).
describe('useTransactionHub', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConnection.stop.mockResolvedValue(undefined)
  })

  it('starts "connecting" and moves to "connected" once start() resolves', async () => {
    mockConnection.start.mockResolvedValue(undefined)
    const { result } = renderHook(() => useTransactionHub(vi.fn()))

    expect(result.current).toBe('connecting')

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current).toBe('connected')
  })

  it('moves to "disconnected" if start() rejects', async () => {
    mockConnection.start.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useTransactionHub(vi.fn()))

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current).toBe('disconnected')
  })

  it('invokes the handler when the server sends TransactionReceived', async () => {
    mockConnection.start.mockResolvedValue(undefined)
    const handler = vi.fn()
    renderHook(() => useTransactionHub(handler))
    await act(async () => {
      await Promise.resolve()
    })

    const registered = mockConnection.on.mock.calls.find(([event]) => event === 'TransactionReceived')?.[1]
    const payload = { transactionId: 'x' }
    registered?.(payload)

    expect(handler).toHaveBeenCalledWith(payload)
  })

  it('invokes the same handler when the server sends TransactionUpdated (docs/DESIGN.md §10)', async () => {
    mockConnection.start.mockResolvedValue(undefined)
    const handler = vi.fn()
    renderHook(() => useTransactionHub(handler))
    await act(async () => {
      await Promise.resolve()
    })

    const registered = mockConnection.on.mock.calls.find(([event]) => event === 'TransactionUpdated')?.[1]
    const payload = { transactionId: 'x', status: 'Completed' }
    registered?.(payload)

    expect(handler).toHaveBeenCalledWith(payload)
  })

  it('transitions reconnecting -> connected via the onreconnecting/onreconnected callbacks', async () => {
    mockConnection.start.mockResolvedValue(undefined)
    const { result } = renderHook(() => useTransactionHub(vi.fn()))
    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current).toBe('connected')

    const onReconnecting = mockConnection.onreconnecting.mock.calls[0][0]
    act(() => onReconnecting())
    expect(result.current).toBe('reconnecting')

    const onReconnected = mockConnection.onreconnected.mock.calls[0][0]
    act(() => onReconnected())
    expect(result.current).toBe('connected')
  })

  it('stops the connection on unmount', () => {
    mockConnection.start.mockResolvedValue(undefined)
    const { unmount } = renderHook(() => useTransactionHub(vi.fn()))

    unmount()

    expect(mockConnection.stop).toHaveBeenCalledTimes(1)
  })
})
