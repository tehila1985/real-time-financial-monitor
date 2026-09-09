import { describe, expect, it } from 'vitest'
import type { Transaction } from '../types/transaction'
import { mergeByIdNewestFirst } from './useTransactionFeed'

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
