import { useState } from 'react'
import { postTransaction } from '../api/transactionsApi'
import type { Transaction, TransactionStatus } from '../types/transaction'

// Single one-click generator — deliberately NOT a bulk/burst button; that's
// `scripts/burst-test.sh` (docs/DESIGN.md §15), kept out of the product UI.
const STATUSES: TransactionStatus[] = ['Pending', 'Completed', 'Failed']
const CURRENCIES = ['USD', 'EUR', 'GBP']

function randomTransaction(): Transaction {
  return {
    transactionId: crypto.randomUUID(),
    amount: Math.round(Math.random() * 1_000_000) / 100,
    currency: CURRENCIES[Math.floor(Math.random() * CURRENCIES.length)],
    status: STATUSES[Math.floor(Math.random() * STATUSES.length)],
    timestamp: new Date().toISOString(),
  }
}

export function TransactionGenerator() {
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle')

  async function handleClick() {
    setState('sending')
    try {
      await postTransaction(randomTransaction())
      setState('idle')
    } catch {
      setState('error')
    }
  }

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={state === 'sending'}>
        Generate mock transaction
      </button>
      {state === 'error' && <p role="alert">Failed to send transaction.</p>}
    </div>
  )
}
