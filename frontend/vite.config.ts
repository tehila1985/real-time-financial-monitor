import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // 'threads' instead of Vitest's default 'forks': subprocess spawning is
    // unreliable in some sandboxed/CI shells (observed here), worker_threads is not.
    pool: 'threads',
  },
})
