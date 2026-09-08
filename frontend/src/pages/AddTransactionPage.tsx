import { TransactionForm } from '../components/TransactionForm'
import { TransactionGenerator } from '../components/TransactionGenerator'

export function AddTransactionPage() {
  return (
    <main>
      <h1>Add Transaction</h1>
      <p>Simulates an external system feeding transactions into the engine.</p>
      <TransactionForm />
      <TransactionGenerator />
    </main>
  )
}
