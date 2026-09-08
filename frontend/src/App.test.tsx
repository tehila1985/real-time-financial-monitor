import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import * as api from './api/transactionsApi'
import * as hub from './realtime/hubConnection'

vi.mock('./api/transactionsApi')
vi.mock('./realtime/hubConnection')

beforeEach(() => {
  vi.mocked(api.getTransactionsSnapshot).mockResolvedValue([])
  vi.mocked(hub.useTransactionHub).mockReturnValue('connected')
})

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App routing', () => {
  it('redirects "/" to the live dashboard', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { name: /live dashboard/i })).toBeInTheDocument()
  })

  it('renders the Add Transaction page at /add', () => {
    renderAt('/add')
    expect(screen.getByRole('heading', { name: /add transaction/i })).toBeInTheDocument()
  })

  it('renders the Monitor page at /monitor', () => {
    renderAt('/monitor')
    expect(screen.getByRole('heading', { name: /live dashboard/i })).toBeInTheDocument()
  })
})
