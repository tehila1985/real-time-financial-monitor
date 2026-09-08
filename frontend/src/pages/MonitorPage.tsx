import { ConnectionStatus } from '../components/ConnectionStatus'
import { FilterBar } from '../components/FilterBar'
import { TransactionTable } from '../components/TransactionTable'
import { useTransactionFeed } from '../state/useTransactionFeed'

export function MonitorPage() {
  const { transactions, statusFilter, setStatusFilter, connectionStatus } = useTransactionFeed()

  return (
    <main>
      <h1>Live Dashboard</h1>
      <ConnectionStatus status={connectionStatus} />
      <FilterBar value={statusFilter} onChange={setStatusFilter} />
      <TransactionTable transactions={transactions} />
    </main>
  )
}
