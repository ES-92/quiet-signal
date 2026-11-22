import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToday } from './useToday'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-03-15T23:59:00+01:00')) // Sonntag kurz vor Mitternacht
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useToday', () => {
  it('liefert einen neuen Tag nach Mitternacht, damit Zeiträume neu berechnet werden', () => {
    // Arrange
    const { result } = renderHook(() => useToday())
    const before = result.current

    // Act
    act(() => {
      vi.advanceTimersByTime(2 * 60_000)
    })

    // Assert
    expect(before.getDate()).toBe(15)
    expect(result.current.getDate()).toBe(16)
    expect(result.current).not.toBe(before)
  })
})
