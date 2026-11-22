import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { TodayHeader } from './TodayHeader'

describe('TodayHeader', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 5, 12))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([
    ['de', '5. März'],
    ['en', 'March 5'],
    ['es', '5 de marzo'],
    ['fr', '5 mars']
  ])('formatiert das Datum mit der App-Sprache %s', (language, expected) => {
    // Arrange
    localStorage.setItem('quiet-signal-language', language)

    // Act
    renderWithProviders(<TodayHeader showReflectionNudge={false} reflectionCount={0} />)

    // Assert
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(expected)
  })
})
