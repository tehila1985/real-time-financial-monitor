import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../api/transactionsApi'
import type { Transaction } from '../types/transaction'
import { AddTransactionPage } from './AddTransactionPage'

vi.mock('../api/transactionsApi')

describe('AddTransactionPage', () => {
  beforeEach(() => {
    vi.mocked(api.postTransaction).mockResolvedValue({} as Transaction)
  })

  it('submits the manual form with a matching payload', async () => {
    const user = userEvent.setup()
    render(<AddTransactionPage />)

    await user.type(screen.getByLabelText(/amount/i), '150.5')
    await user.clear(screen.getByLabelText(/currency/i))
    await user.type(screen.getByLabelText(/currency/i), 'EUR')
    await user.selectOptions(screen.getByLabelText(/status/i), 'Completed')
    await user.click(screen.getByRole('button', { name: /submit transaction/i }))

    expect(api.postTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 150.5, currency: 'EUR', status: 'Completed' }),
    )
  })

  it('the generator button posts a transaction without requiring form input', async () => {
    const user = userEvent.setup()
    render(<AddTransactionPage />)

    await user.click(screen.getByRole('button', { name: /generate mock transaction/i }))

    expect(api.postTransaction).toHaveBeenCalledTimes(1)
  })

  it('rejects a blank amount instead of silently submitting zero (found in code review)', () => {
    // fireEvent.submit dispatches the submit event directly, bypassing the
    // input's native `required`/`type="number"` constraint validation — this
    // is what actually exercises the component's own guard, not the browser's.
    render(<AddTransactionPage />)

    fireEvent.submit(screen.getByRole('button', { name: /submit transaction/i }).closest('form')!)

    expect(api.postTransaction).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/check the amount/i)
  })
})
