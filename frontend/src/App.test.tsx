import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

// Placeholder confirming the test harness is wired up (Vitest + RTL + jsdom).
// Replaced by real page/component tests in Phase 5 (see docs/DESIGN.md §22).
describe('App', () => {
  it('renders the placeholder heading', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: /real-time financial monitor/i }),
    ).toBeInTheDocument()
  })
})
