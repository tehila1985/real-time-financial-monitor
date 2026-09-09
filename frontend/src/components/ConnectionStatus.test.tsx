import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ConnectionState } from '../realtime/hubConnection'
import { ConnectionStatus } from './ConnectionStatus'

describe('ConnectionStatus', () => {
  it.each<[ConnectionState, string]>([
    ['connecting', 'Connecting…'],
    ['connected', 'Connected'],
    ['reconnecting', 'Reconnecting…'],
    ['disconnected', 'Disconnected'],
  ])('renders the label for "%s"', (status, label) => {
    render(<ConnectionStatus status={status} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('shows a refresh hint when disconnected', () => {
    render(<ConnectionStatus status="disconnected" />)
    expect(screen.getByText(/refresh the page to reconnect/i)).toBeInTheDocument()
  })

  it('does not show the refresh hint when connected', () => {
    render(<ConnectionStatus status="connected" />)
    expect(screen.queryByText(/refresh the page to reconnect/i)).not.toBeInTheDocument()
  })
})
