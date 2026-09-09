import { useState, type FormEvent } from 'react'
import { postTransaction } from '../api/transactionsApi'
import { useAutoResettingState } from '../state/useAutoResettingState'
import { TRANSACTION_STATUSES, type Transaction, type TransactionStatus } from '../types/transaction'
import { generateId } from '../utils/generateId'

/** Manual entry half of /add — see TransactionGenerator for the one-click half. */
export function TransactionForm() {
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [status, setStatus] = useState<TransactionStatus>('Pending')
  const [submitState, setSubmitState, setSubmitStateWithAutoReset] = useAutoResettingState<
    'idle' | 'sending' | 'success' | 'error'
  >('idle', 'idle')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    // Defense-in-depth beyond the input's `required`/`type="number"` HTML
    // validation (found in code review): `Number('')` is `0`, not `NaN`, so a
    // blank amount that somehow reached this handler would otherwise submit
    // silently as a zero-amount transaction instead of being rejected.
    const parsedAmount = Number(amount)
    if (amount.trim() === '' || Number.isNaN(parsedAmount)) {
      setSubmitState('error')
      return
    }

    const transaction: Transaction = {
      transactionId: generateId(),
      amount: parsedAmount,
      currency,
      status,
      timestamp: new Date().toISOString(),
    }

    setSubmitState('sending')
    try {
      await postTransaction(transaction)
      setSubmitStateWithAutoReset('success')
      setAmount('')
    } catch {
      setSubmitState('error')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="section-title">Manual entry</h2>

      <div className="form-field">
        <label htmlFor="tx-amount">Amount</label>
        <input
          id="tx-amount"
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>

      <div className="form-field">
        <label htmlFor="tx-currency">Currency</label>
        <input id="tx-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} required />
      </div>

      <div className="form-field">
        <label htmlFor="tx-status">Status</label>
        <select id="tx-status" value={status} onChange={(e) => setStatus(e.target.value as TransactionStatus)}>
          {TRANSACTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <button type="submit" className="btn btn-primary" disabled={submitState === 'sending'}>
        {submitState === 'sending' ? 'Submitting…' : 'Submit transaction'}
      </button>
      {submitState === 'success' && (
        <p className="alert alert--success" role="status">
          ✓ Transaction submitted successfully.
        </p>
      )}
      {submitState === 'error' && (
        <p className="alert" role="alert">
          Failed to submit transaction. Check the amount and try again.
        </p>
      )}
    </form>
  )
}
