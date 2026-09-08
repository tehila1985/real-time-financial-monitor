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

  // Merges through applyBatch rather than overwriting outright: if a live
  // enqueue()'d item already flushed into state before this resolves (a real
  // race — the snapshot fetch and the SignalR connection start concurrently
  // on mount, with no guaranteed order), a plain `setItems(initial)` would
  // silently discard it. Treating the snapshot as "the initial batch" through
  // the same merge function used for live updates makes seeding order-safe.
  const seed = useCallback((initial: T[]) => setItems((previous) => applyBatch(previous, initial)), [applyBatch])

  return { items, enqueue, seed }
}
