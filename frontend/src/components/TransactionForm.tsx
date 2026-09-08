import { useState, type FormEvent } from 'react'
import { postTransaction } from '../api/transactionsApi'
import type { Transaction, TransactionStatus } from '../types/transaction'

const STATUSES: TransactionStatus[] = ['Pending', 'Completed', 'Failed']

/** Manual entry half of /add — see TransactionGenerator for the one-click half. */
export function TransactionForm() {
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [status, setStatus] = useState<TransactionStatus>('Pending')
  const [submitState, setSubmitState] = useState<'idle' | 'sending' | 'error'>('idle')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const transaction: Transaction = {
      transactionId: crypto.randomUUID(),
      amount: Number(amount),
      currency,
      status,
      timestamp: new Date().toISOString(),
    }

    setSubmitState('sending')
    try {
      await postTransaction(transaction)
      setSubmitState('idle')
      setAmount('')
    } catch {
      setSubmitState('error')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Amount
        <input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </label>
      <label>
        Currency
        <input value={currency} onChange={(e) => setCurrency(e.target.value)} required />
      </label>
      <label>
        Status
        <select value={status} onChange={(e) => setStatus(e.target.value as TransactionStatus)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={submitState === 'sending'}>
        Submit transaction
      </button>
      {submitState === 'error' && <p role="alert">Failed to submit transaction.</p>}
    </form>
  )
}
