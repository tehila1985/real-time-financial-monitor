import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useBatchedUpdates } from './useBatchedUpdates'

describe('useBatchedUpdates', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('coalesces many fast enqueue calls into a single animation-frame flush', () => {
    let rafCallback: FrameRequestCallback | undefined
    const rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb) => {
        rafCallback = cb
        return 1
      })

    const { result } = renderHook(() =>
      useBatchedUpdates<number>((previous, batch) => [...previous, ...batch]),
    )

    act(() => {
      for (let i = 0; i < 100; i++) {
        result.current.enqueue(i)
      }
    })

    // The whole point of docs/DESIGN.md §16: 100 arrivals schedule exactly one
    // flush, not 100 renders.
    expect(rafSpy).toHaveBeenCalledTimes(1)
    expect(result.current.items).toHaveLength(0) // not flushed yet

    act(() => {
      rafCallback?.(0)
    })

    expect(result.current.items).toHaveLength(100)
  })

  it('schedules a new frame for items that arrive after a flush', () => {
    const rafCallbacks: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })

    const { result } = renderHook(() =>
      useBatchedUpdates<number>((previous, batch) => [...previous, ...batch]),
    )

    act(() => result.current.enqueue(1))
    act(() => rafCallbacks[0]?.(0))
    act(() => result.current.enqueue(2))

    expect(rafCallbacks).toHaveLength(2)

    act(() => rafCallbacks[1]?.(0))
    expect(result.current.items).toEqual([1, 2])
  })

  it('seed applies immediately (bypassing the animation-frame buffer) when nothing was there before', () => {
    const { result } = renderHook(() =>
      useBatchedUpdates<number>((previous, batch) => [...previous, ...batch]),
    )

    act(() => result.current.seed([10, 20]))

    expect(result.current.items).toEqual([10, 20])
  })

  it('seed merges rather than overwrites — a live item that already flushed is not lost', () => {
    // Regression test: seed() used to be a plain setItems(initial), which
    // silently discarded any item a concurrent enqueue() had already flushed
    // into state before the seed (e.g. a snapshot fetch resolving after a
    // SignalR message already arrived — there's no guaranteed order between
    // the two on mount).
    let rafCallback: FrameRequestCallback | undefined
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallback = cb
      return 1
    })

    const { result } = renderHook(() =>
      useBatchedUpdates<number>((previous, batch) => [...previous, ...batch]),
    )

    act(() => result.current.enqueue(99)) // a "live" item arrives first...
    act(() => rafCallback?.(0)) // ...and flushes into state...
    expect(result.current.items).toEqual([99])

    act(() => result.current.seed([10, 20])) // ...before the "snapshot" seed lands

    expect(result.current.items).toEqual([99, 10, 20])
  })
})
