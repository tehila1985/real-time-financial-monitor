import { useCallback, useRef, useState } from 'react'

/**
 * Buffers incoming items outside React state and flushes them via a single
 * self-rescheduling requestAnimationFrame callback — bounding render
 * frequency to the browser's repaint rate regardless of arrival rate. This is
 * the actual mechanism behind docs/DESIGN.md §16 (the "100 transactions
 * arrive quickly" requirement); kept generic and free of any SignalR/fetch
 * knowledge so it can be unit-tested in isolation.
 */
export function useBatchedUpdates<T>(applyBatch: (previous: T[], batch: T[]) => T[]) {
  const [items, setItems] = useState<T[]>([])
  const pendingRef = useRef<T[]>([])
  const scheduledRef = useRef(false)

  const enqueue = useCallback(
    (item: T) => {
      pendingRef.current.push(item)
      if (!scheduledRef.current) {
        scheduledRef.current = true
        requestAnimationFrame(() => {
          scheduledRef.current = false
          const batch = pendingRef.current
          pendingRef.current = []
          setItems((previous) => applyBatch(previous, batch))
        })
      }
    },
    [applyBatch],
  )

  const seed = useCallback((initial: T[]) => setItems(initial), [])

  return { items, enqueue, seed }
}
