import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * State that can optionally revert to `resetTo` a fixed delay after being
 * set — the "show a success message, then go back to idle" pattern that
 * TransactionForm and TransactionGenerator both implemented separately
 * (found duplicated in code review; study/19). Owns its own pending-timeout
 * cleanup on unmount, so callers can't forget it the way both copies of this
 * logic once had to remember it independently.
 */
export function useAutoResettingState<T>(initial: T, resetTo: T, delayMs = 3000) {
  const [state, setState] = useState(initial)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
    }
  }, [])

  // For transitions that should NOT auto-revert (e.g. 'sending', 'error') —
  // plain state updates, same as any other useState setter.
  const setWithoutReset = useCallback((value: T) => {
    setState(value)
  }, [])

  // For the transition that should revert on its own (e.g. 'success' -> 'idle').
  const setWithAutoReset = useCallback(
    (value: T) => {
      setState(value)
      timeoutRef.current = setTimeout(() => setState(resetTo), delayMs)
    },
    [resetTo, delayMs],
  )

  return [state, setWithoutReset, setWithAutoReset] as const
}
