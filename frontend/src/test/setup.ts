import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Explicit unmount between tests. @testing-library/react normally registers
// this automatically, but only when it detects the test framework's global
// `afterEach` — which isn't present here since `test.globals` is off
// (deliberately explicit imports, see vite.config.ts).
afterEach(() => {
  cleanup()
})
