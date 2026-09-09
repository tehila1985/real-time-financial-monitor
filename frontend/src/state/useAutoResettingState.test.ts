import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAutoResettingState } from './useAutoResettingState'

describe('useAutoResettingState', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts at the initial value', () => {
    const { result } = renderHook(() => useAutoResettingState('idle', 'idle'))

    expect(result.current[0]).toBe('idle')
  })

  it('setWithoutReset updates the value and never schedules a revert', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useAutoResettingState('idle', 'idle'))

    act(() => result.current[1]('sending'))
    expect(result.current[0]).toBe('sending')

    act(() => vi.advanceTimersByTime(10_000))
    expect(result.current[0]).toBe('sending') // still — no auto-reset was scheduled
  })

  it('setWithAutoReset updates the value, then reverts to resetTo after the delay', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useAutoResettingState<'idle' | 'success'>('idle', 'idle', 3000))

    act(() => result.current[2]('success'))
    expect(result.current[0]).toBe('success')

    act(() => vi.advanceTimersByTime(2999))
    expect(result.current[0]).toBe('success') // not yet

    act(() => vi.advanceTimersByTime(1))
    expect(result.current[0]).toBe('idle') // reverted
  })

  it('clears the pending revert timeout on unmount (no state update on an unmounted component)', () => {
    vi.useFakeTimers()
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    const { result, unmount } = renderHook(() => useAutoResettingState<'idle' | 'success'>('idle', 'idle'))

    act(() => result.current[2]('success'))
    unmount()

    expect(clearTimeoutSpy).toHaveBeenCalled()
  })
})
