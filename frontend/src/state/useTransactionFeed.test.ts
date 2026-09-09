import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../api/transactionsApi'
import * as hub from '../realtime/hubConnection'
import type { Transaction } from '../types/transaction'
import { mergeByIdNewestFirst, useTransactionFeed } from './useTransactionFeed'

vi.mock('../api/transactionsApi')
vi.mock('../realtime/hubConnection')

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    transactionId: crypto.randomUUID(),
    amount: 100,
    currency: 'USD',
    status: 'Pending',
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

describe('mergeByIdNewestFirst', () => {
  it('merges previous and incoming items, sorted newest-first', () => {
    const now = Date.now()
    const older = makeTransaction({ transactionId: 'a', timestamp: new Date(now - 5000).toISOString() })
    const newer = makeTransaction({ transactionId: 'b', timestamp: new Date(now).toISOString() })

    expect(mergeByIdNewestFirst([older], [newer])).toEqual([newer, older])
  })

  it('replaces an existing id in place rather than duplicating it', () => {
    const original = makeTransaction({ transactionId: 'a', status: 'Pending' })
    const updated = { ...original, status: 'Completed' as const }

    const result = mergeByIdNewestFirst([original], [updated])

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(updated)
  })

  it('caps the retained set at 1000, keeping the most recent (regression: was unbounded)', () => {
    const now = Date.now()
    const previous = Array.from({ length: 1000 }, (_, i) =>
      makeTransaction({ transactionId: `old-${i}`, timestamp: new Date(now - i).toISOString() }),
    )
    const incoming = makeTransaction({ transactionId: 'newest', timestamp: new Date(now + 1000).toISOString() })

    const result = mergeByIdNewestFirst(previous, [incoming])

    expect(result).toHaveLength(1000)
    expect(result[0].transactionId).toBe('newest') // newest survives
    expect(result.some((t) => t.transactionId === 'old-999')).toBe(false) // oldest evicted
  })
})

describe('useTransactionFeed reconnection backfill', () => {
  // Regression test for a gap found in a fresh audit: withAutomaticReconnect()
  // resumes the WebSocket after a drop, but nothing previously re-delivered
  // whatever was broadcast while it was down. The fix re-fetches the snapshot
  // specifically on a reconnecting -> connected transition — not on every
  // status change, and not a second time on the initial connect.
  let connectionStatus: hub.ConnectionState

  beforeEach(() => {
    connectionStatus = 'connected'
    vi.mocked(hub.useTransactionHub).mockImplementation(() => connectionStatus)
    vi.mocked(api.getTransactionsSnapshot).mockResolvedValue([])
  })

  it('fetches once on mount, again only after an actual reconnect', async () => {
    const { rerender } = renderHook(() => useTransactionFeed())
    await act(async () => {
      await Promise.resolve()
    })
    expect(api.getTransactionsSnapshot).toHaveBeenCalledTimes(1)

    connectionStatus = 'reconnecting'
    rerender()
    await act(async () => {
      await Promise.resolve()
    })
    expect(api.getTransactionsSnapshot).toHaveBeenCalledTimes(1) // not yet — still down

    connectionStatus = 'connected'
    rerender()
    await act(async () => {
      await Promise.resolve()
    })
    expect(api.getTransactionsSnapshot).toHaveBeenCalledTimes(2) // backfill on actual reconnect
  })

  it('does not re-fetch on the initial connecting -> connected transition', async () => {
    connectionStatus = 'connecting'
    const { rerender } = renderHook(() => useTransactionFeed())
    await act(async () => {
      await Promise.resolve()
    })

    connectionStatus = 'connected'
    rerender()
    await act(async () => {
      await Promise.resolve()
    })

    expect(api.getTransactionsSnapshot).toHaveBeenCalledTimes(1) // the one mount-time fetch only
  })
})
