import { ConnectionStatus } from '../components/ConnectionStatus'
import { FilterBar } from '../components/FilterBar'
import { TransactionTable } from '../components/TransactionTable'
import { useTransactionFeed } from '../state/useTransactionFeed'

export function MonitorPage() {
  const { transactions, statusFilter, setStatusFilter, connectionStatus, snapshotError } = useTransactionFeed()

  return (
    <main className="page">
      <h1>Live Dashboard</h1>
      <p className="page-subtitle">Transactions appear here the moment they're ingested.</p>

      <ConnectionStatus status={connectionStatus} />
      {snapshotError && (
        <p className="alert alert--warning" role="alert">
          ⚠ Could not load existing transactions. New ones will still arrive live.
        </p>
      )}
      <FilterBar value={statusFilter} onChange={setStatusFilter} />
      <TransactionTable transactions={transactions} />
    </main>
  )
}
