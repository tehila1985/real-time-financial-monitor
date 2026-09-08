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

  it('seed replaces the current items immediately, without going through the buffer', () => {
    const { result } = renderHook(() =>
      useBatchedUpdates<number>((previous, batch) => [...previous, ...batch]),
    )

    act(() => result.current.seed([10, 20]))

    expect(result.current.items).toEqual([10, 20])
  })
})
