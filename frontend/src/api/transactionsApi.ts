import type { Transaction } from '../types/transaction'

// Empty in production (same-origin, via nginx reverse proxy — §18); set to the
// backend's dev port in .env.development for local cross-origin dev.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const TRANSACTIONS_URL = `${API_BASE_URL}/api/transactions`

async function fetchJson<T>(input: RequestInfo, init: RequestInit | undefined, action: string): Promise<T> {
  const response = await fetch(input, init)
  if (!response.ok) {
    throw new Error(`Failed to ${action} (${response.status})`)
  }
  return response.json() as Promise<T>
}

export function postTransaction(transaction: Transaction): Promise<Transaction> {
  return fetchJson<Transaction>(
    TRANSACTIONS_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction),
    },
    'submit transaction',
  )
}

export function getTransactionsSnapshot(): Promise<Transaction[]> {
  return fetchJson<Transaction[]>(TRANSACTIONS_URL, undefined, 'fetch transactions')
}
