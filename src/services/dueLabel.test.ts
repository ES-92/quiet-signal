import { beforeEach, describe, expect, it } from 'vitest'
import { makeQuote, resetFactories } from '../test/factories'
import { dueInDays, formatDueIn } from './dueLabel'

const now = new Date(2026, 5, 10, 14, 30) // 10 June 2026, local

function at(dayOffset: number, hour = 6): string {
  return new Date(2026, 5, 10 + dayOffset, hour).toISOString()
}

beforeEach(() => {
  resetFactories()
})

describe('dueInDays', () => {
  it('is 0 for a review later today', () => {
    // Arrange
    const quote = makeQuote({ nextReviewAt: at(0, 22) })

    // Act / Assert
    expect(dueInDays(quote, now)).toBe(0)
  })

  it('is 0 for an overdue review', () => {
    expect(dueInDays(makeQuote({ nextReviewAt: at(-5) }), now)).toBe(0)
  })

  it('is 0 without a review date', () => {
    expect(dueInDays(makeQuote({ nextReviewAt: undefined }), now)).toBe(0)
  })

  it('counts calendar days, not 24h blocks', () => {
    expect(dueInDays(makeQuote({ nextReviewAt: at(1, 6) }), now)).toBe(1)
    expect(dueInDays(makeQuote({ nextReviewAt: at(12, 6) }), now)).toBe(12)
  })

  it('caps a legacy favourite stored far in the future via effectiveDueAt', () => {
    // Arrange
    const quote = makeQuote({ favorite: true, nextReviewAt: at(300), lastReviewedAt: new Date(2026, 5, 10, 9).toISOString() })

    // Act / Assert
    expect(dueInDays(quote, now)).toBe(30)
  })
})

describe('formatDueIn', () => {
  it('says today, tomorrow and in N days in the locale', () => {
    expect(formatDueIn(0, 'de-DE')).toBe('heute')
    expect(formatDueIn(1, 'de-DE')).toBe('morgen')
    expect(formatDueIn(12, 'de-DE')).toBe('in 12 Tagen')
    expect(formatDueIn(12, 'en-US')).toBe('in 12 days')
  })

  it('stays in days up to 60 days', () => {
    expect(formatDueIn(60, 'de-DE')).toBe('in 60 Tagen')
  })

  it('switches to months beyond 60 days', () => {
    expect(formatDueIn(90, 'de-DE')).toBe('in 3 Monaten')
    expect(formatDueIn(365, 'en-US')).toBe('in 12 months')
  })
})
