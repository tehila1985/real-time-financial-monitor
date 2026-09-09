import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../api/transactionsApi'
import { TransactionForm } from './TransactionForm'

vi.mock('../api/transactionsApi')

// Component-level tests, isolated from AddTransactionPage: those tests only
// prove postTransaction is called with the right payload — they never
// assert what the user actually sees. This is the layer that closes that
// gap, complementing useAutoResettingState's own hook-only unit tests.
describe('TransactionForm', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a success message after a successful submit, then hides it again after the delay', async () => {
    vi.mocked(api.postTransaction).mockResolvedValue({
      transactionId: '1',
      amount: 10,
      currency: 'USD',
      status: 'Pending',
      timestamp: new Date().toISOString(),
    })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<TransactionForm />)

    await user.type(screen.getByLabelText(/amount/i), '10')
    await user.click(screen.getByRole('button', { name: /submit transaction/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(/submitted successfully/i)

    await act(() => vi.advanceTimersByTimeAsync(3000))

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows an error message when the API call fails', async () => {
    vi.mocked(api.postTransaction).mockRejectedValue(new Error('network error'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<TransactionForm />)

    await user.type(screen.getByLabelText(/amount/i), '10')
    await user.click(screen.getByRole('button', { name: /submit transaction/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/failed to submit/i)
  })
})
