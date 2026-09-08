import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { TransactionStatus } from '../types/transaction'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it.each<TransactionStatus>(['Pending', 'Completed', 'Failed'])(
    'renders the %s label',
    (status) => {
      render(<StatusBadge status={status} />)
      expect(screen.getByText(status)).toBeInTheDocument()
    },
  )

  it('uses a distinct color for Failed vs Completed', () => {
    const { unmount } = render(<StatusBadge status="Failed" />)
    const failedColor = screen.getByText('Failed').style.backgroundColor
    unmount()

    render(<StatusBadge status="Completed" />)
    const completedColor = screen.getByText('Completed').style.backgroundColor

    expect(failedColor).not.toBe(completedColor)
  })
})
