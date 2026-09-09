import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../api/transactionsApi'
import { TransactionGenerator } from './TransactionGenerator'

vi.mock('../api/transactionsApi')

describe('TransactionGenerator', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a success message after a successful click, then hides it again after the delay', async () => {
    vi.mocked(api.postTransaction).mockResolvedValue({
      transactionId: '1',
      amount: 10,
      currency: 'USD',
      status: 'Pending',
      timestamp: new Date().toISOString(),
    })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<TransactionGenerator />)

    await user.click(screen.getByRole('button', { name: /generate mock transaction/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(/generated successfully/i)

    await act(() => vi.advanceTimersByTimeAsync(3000))

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows an error message when the API call fails', async () => {
    vi.mocked(api.postTransaction).mockRejectedValue(new Error('network error'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<TransactionGenerator />)

    await user.click(screen.getByRole('button', { name: /generate mock transaction/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/failed to send/i)
  })
})
