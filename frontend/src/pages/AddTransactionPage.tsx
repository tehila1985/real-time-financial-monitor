import { TransactionForm } from '../components/TransactionForm'
import { TransactionGenerator } from '../components/TransactionGenerator'

export function AddTransactionPage() {
  return (
    <main className="page">
      <h1>Add Transaction</h1>
      <p className="page-subtitle">Simulates an external system feeding transactions into the engine.</p>

      <div className="card">
        <TransactionForm />
      </div>
      <div className="card">
        <TransactionGenerator />
      </div>
    </main>
  )
}
