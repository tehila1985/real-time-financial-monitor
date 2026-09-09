import { postTransaction } from '../api/transactionsApi'
import { useAutoResettingState } from '../state/useAutoResettingState'
import { TRANSACTION_STATUSES, type Transaction } from '../types/transaction'
import { generateId } from '../utils/generateId'

// Single one-click generator — deliberately NOT a bulk/burst button; that's
// `scripts/burst-test.sh` (docs/DESIGN.md §15), kept out of the product UI.
const CURRENCIES = ['USD', 'EUR', 'GBP']

function randomTransaction(): Transaction {
  return {
    transactionId: generateId(),
    amount: Math.round(Math.random() * 1_000_000) / 100,
    currency: CURRENCIES[Math.floor(Math.random() * CURRENCIES.length)],
    status: TRANSACTION_STATUSES[Math.floor(Math.random() * TRANSACTION_STATUSES.length)],
    timestamp: new Date().toISOString(),
  }
}

export function TransactionGenerator() {
  const [state, setState, setStateWithAutoReset] = useAutoResettingState<
    'idle' | 'sending' | 'success' | 'error'
  >('idle', 'idle')

  async function handleClick() {
    setState('sending')
    try {
      await postTransaction(randomTransaction())
      setStateWithAutoReset('success')
    } catch {
      setState('error')
    }
  }

  return (
    <div>
      <h2 className="section-title">Or generate one</h2>
      <button type="button" className="btn btn-secondary" onClick={handleClick} disabled={state === 'sending'}>
        {state === 'sending' ? 'Generating…' : 'Generate mock transaction'}
      </button>
      {state === 'success' && (
        <p className="alert alert--success" role="status">
          ✓ Transaction generated successfully.
        </p>
      )}
      {state === 'error' && (
        <p className="alert" role="alert">
          Failed to send transaction.
        </p>
      )}
    </div>
  )
}
