import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../api/transactionsApi'
import type { Transaction } from '../types/transaction'
import { TransactionTable } from './TransactionTable'

vi.mock('../api/transactionsApi')

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
  beforeEach(() => {
    vi.mocked(api.updateTransactionStatus).mockResolvedValue(makeTransaction())
  })

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

    // Asserting against `title` (the full, untruncated id) rather than the
    // visible cell text: the cell only ever shows `id.slice(0, 8)`, so a
    // text-based assertion would pass by coincidence for these short test
    // ids and give false confidence — it wouldn't catch a real 36-char GUID
    // being truncated to the wrong id. `title` holds the real value.
    expect(screen.queryByTitle('id-199')).toBeInTheDocument()
    expect(screen.queryByTitle('id-200')).not.toBeInTheDocument()
  })

  it('applies the entrance-animation class to each row (Bonus 5)', () => {
    render(<TransactionTable transactions={[makeTransaction({ transactionId: 'a' })]} />)

    const [, dataRow] = screen.getAllByRole('row') // [header, data row]
    expect(dataRow).toHaveClass('transaction-row')
  })

  describe('status-update actions (docs/DESIGN.md §10)', () => {
    it('shows Complete/Fail actions only for a Pending transaction', () => {
      render(
        <TransactionTable
          transactions={[
            makeTransaction({ transactionId: 'pending', status: 'Pending' }),
            makeTransaction({ transactionId: 'completed', status: 'Completed' }),
          ]}
        />,
      )

      expect(screen.getAllByRole('button', { name: 'Complete' })).toHaveLength(1)
      expect(screen.getAllByRole('button', { name: 'Fail' })).toHaveLength(1)
    })

    it('renders no actions at all for a terminal (Completed/Failed) transaction', () => {
      render(<TransactionTable transactions={[makeTransaction({ status: 'Completed' })]} />)

      expect(screen.queryByRole('button', { name: 'Complete' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Fail' })).not.toBeInTheDocument()
    })

    it('clicking Complete calls updateTransactionStatus with the transaction id and the new status', async () => {
      const user = userEvent.setup()
      const transaction = makeTransaction({ transactionId: 'tx-1', status: 'Pending' })
      render(<TransactionTable transactions={[transaction]} />)

      await user.click(screen.getByRole('button', { name: 'Complete' }))

      expect(api.updateTransactionStatus).toHaveBeenCalledWith('tx-1', 'Completed')
    })

    it('clicking Fail calls updateTransactionStatus with "Failed"', async () => {
      const user = userEvent.setup()
      const transaction = makeTransaction({ transactionId: 'tx-1', status: 'Pending' })
      render(<TransactionTable transactions={[transaction]} />)

      await user.click(screen.getByRole('button', { name: 'Fail' }))

      expect(api.updateTransactionStatus).toHaveBeenCalledWith('tx-1', 'Failed')
    })

    it('shows an inline error if the update fails, without crashing the row', async () => {
      vi.mocked(api.updateTransactionStatus).mockRejectedValue(new Error('network error'))
      const user = userEvent.setup()
      render(<TransactionTable transactions={[makeTransaction({ status: 'Pending' })]} />)

      await user.click(screen.getByRole('button', { name: 'Complete' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/update failed/i)
      // still actionable afterwards — not stuck in a disabled/broken state
      expect(screen.getByRole('button', { name: 'Complete' })).not.toBeDisabled()
    })
  })
})
