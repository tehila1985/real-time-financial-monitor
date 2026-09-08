import type { Transaction } from '../types/transaction'

// Empty in production (same-origin, via nginx reverse proxy — §18); set to the
// backend's dev port in .env.development for local cross-origin dev.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const TRANSACTIONS_URL = `${API_BASE_URL}/api/transactions`

export async function postTransaction(transaction: Transaction): Promise<Transaction> {
  const response = await fetch(TRANSACTIONS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transaction),
  })
  if (!response.ok) {
    throw new Error(`Failed to submit transaction (${response.status})`)
  }
  return response.json() as Promise<Transaction>
}

export async function getTransactionsSnapshot(): Promise<Transaction[]> {
  const response = await fetch(TRANSACTIONS_URL)
  if (!response.ok) {
    throw new Error(`Failed to fetch transactions (${response.status})`)
  }
  return response.json() as Promise<Transaction[]>
}
