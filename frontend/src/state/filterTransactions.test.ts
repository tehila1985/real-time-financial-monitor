import { describe, expect, it } from 'vitest'
import type { Transaction } from '../types/transaction'
import { filterTransactions } from './filterTransactions'

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

describe('filterTransactions', () => {
  it('returns everything when the filter is "All"', () => {
    const list = [makeTransaction({ status: 'Pending' }), makeTransaction({ status: 'Failed' })]

    expect(filterTransactions(list, 'All')).toEqual(list)
  })

  it('returns only transactions matching the given status', () => {
    const failed = makeTransaction({ status: 'Failed' })
    const list = [makeTransaction({ status: 'Pending' }), failed, makeTransaction({ status: 'Completed' })]

    expect(filterTransactions(list, 'Failed')).toEqual([failed])
  })

  it('returns an empty array when nothing matches', () => {
    const list = [makeTransaction({ status: 'Pending' })]

    expect(filterTransactions(list, 'Failed')).toEqual([])
  })
})
