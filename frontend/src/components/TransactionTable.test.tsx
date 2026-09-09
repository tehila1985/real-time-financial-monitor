import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Transaction } from '../types/transaction'
import { TransactionTable } from './TransactionTable'

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

describe('TransactionTable', () => {
  it('renders one row per transaction, including its status', () => {
    const transactions = [
      makeTransaction({ transactionId: 'a', status: 'Completed' }),
      makeTransaction({ transactionId: 'b', status: 'Failed' }),
    ]

    render(<TransactionTable transactions={transactions} />)

    // header row + 2 data rows
    expect(screen.getAllByRole('row')).toHaveLength(3)
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('renders at most 200 rows even when given more transactions (docs/DESIGN.md §16)', () => {
    const many = Array.from({ length: 250 }, (_, i) =>
      makeTransaction({ transactionId: `id-${i}` }),
    )

    render(<TransactionTable transactions={many} />)

    // header row + 200 data rows, not 250
    expect(screen.getAllByRole('row')).toHaveLength(201)
  })

  it('keeps only the first 200 of the given order — callers are responsible for sorting newest-first', () => {
    const many = Array.from({ length: 250 }, (_, i) =>
      makeTransaction({ transactionId: `id-${i}` }),
    )

    render(<TransactionTable transactions={many} />)

    expect(screen.queryByText('id-199')).toBeInTheDocument()
    expect(screen.queryByText('id-200')).not.toBeInTheDocument()
  })

  it('applies the entrance-animation class to each row (Bonus 5)', () => {
    render(<TransactionTable transactions={[makeTransaction({ transactionId: 'a' })]} />)

    const [, dataRow] = screen.getAllByRole('row') // [header, data row]
    expect(dataRow).toHaveClass('transaction-row')
  })
})
