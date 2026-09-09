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
})
