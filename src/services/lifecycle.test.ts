import { describe, expect, it } from 'vitest'
import { makeQuote } from '../test/factories'
import {
  daysUnclarified,
  effectiveDueAt,
  effectiveInterval,
  favoriteTogglePatch,
  lessOftenPatch,
  moreOftenPatch,
  restPatch,
  reviewDateFromInterval,
  statusChangePatch,
  wakePatch
} from './lifecycle'

const now = new Date('2026-11-21T15:00:00+01:00')

describe('effectiveInterval', () => {
  it('uses the stored interval', () => expect(effectiveInterval({ reviewIntervalDays: 12, reviewCount: 9 })).toBe(12))
  it.each([[0, 1], [1, 3], [2, 7], [9, 7]])('derives %i reviews → %i days', (count, days) =>
    expect(effectiveInterval({ reviewCount: count })).toBe(days))
})

describe('reviewDateFromInterval', () => {
  it('lands at 06:00 local on the target day', () => {
    expect(reviewDateFromInterval(5, now)).toBe(new Date('2026-11-26T06:00:00+01:00').toISOString())
  })
  it('handles the DST switch (Europe/Berlin)', () => {
    const dstNow = new Date('2027-03-27T12:00:00+01:00')
    expect(reviewDateFromInterval(1, dstNow)).toBe(new Date('2027-03-28T06:00:00+02:00').toISOString())
  })
})

describe('moreOftenPatch', () => {
  it('grows 1,2,3,5,8,12,18,27,41,62,93,140,210,315,365,365', () => {
    const seen: number[] = []
    let quote = makeQuote({ reviewIntervalDays: 1 })
    for (let i = 0; i < 15; i++) { quote = { ...quote, ...moreOftenPatch(quote, now) }; seen.push(quote.reviewIntervalDays!) }
    expect(seen).toEqual([2, 3, 5, 8, 12, 18, 27, 41, 62, 93, 140, 210, 315, 365, 365])
  })
  it('adds a like and counts the review', () => {
    const patch = moreOftenPatch(makeQuote({ likes: 2, reviewCount: 4, reviewIntervalDays: 3 }), now)
    expect(patch).toMatchObject({ likes: 3, reviewCount: 5, reviewIntervalDays: 5, lastReviewedAt: now.toISOString() })
  })
  it('starts from the derived interval for legacy rows', () =>
    expect(moreOftenPatch(makeQuote({ reviewCount: 2 }), now).reviewIntervalDays).toBe(11))
})

describe('lessOftenPatch', () => {
  it.each([[1, 14], [8, 32], [100, 365]])('%i days → %i days', (from, to) =>
    expect(lessOftenPatch(makeQuote({ reviewIntervalDays: from }), now).reviewIntervalDays).toBe(to))
  it('schedules the next review and counts it', () => {
    const patch = lessOftenPatch(makeQuote({ reviewCount: 2, reviewIntervalDays: 8 }), now)
    expect(patch).toMatchObject({
      nextReviewAt: reviewDateFromInterval(32, now),
      reviewCount: 3,
      lastReviewedAt: now.toISOString()
    })
  })
  it('rounds a fractional interval up before applying the cap', () =>
    expect(lessOftenPatch(makeQuote({ reviewIntervalDays: 15.3 }), now).reviewIntervalDays).toBe(62))
  it('does not touch likes', () => expect(lessOftenPatch(makeQuote({ likes: 3 }), now)).not.toHaveProperty('likes'))
})

describe('restPatch / wakePatch / statusChangePatch', () => {
  it('rest clears snooze and keeps interval', () => {
    const patch = restPatch(makeQuote({ snoozedUntil: 'x', reviewIntervalDays: 8 }), now)
    expect(patch).toMatchObject({ status: 'rest', snoozedUntil: undefined, updatedAt: now.toISOString() })
    expect(patch).not.toHaveProperty('reviewIntervalDays')
  })
  it('wake restarts at one day', () =>
    expect(wakePatch(makeQuote({ status: 'rest', reviewIntervalDays: 90 }), now)).toMatchObject({
      status: 'signal', reviewIntervalDays: 1, nextReviewAt: reviewDateFromInterval(1, now), snoozedUntil: undefined, updatedAt: now.toISOString() }))
  it.each([['inbox', 'signal'], ['rest', 'signal']] as const)('%s → %s starts at one day', (from, to) =>
    expect(statusChangePatch(from, to, now)).toMatchObject({ reviewIntervalDays: 1 }))
  it('signal → signal changes nothing', () => expect(statusChangePatch('signal', 'signal', now)).toEqual({}))
  it('→ rest clears snooze', () => expect(statusChangePatch('signal', 'rest', now)).toEqual({ snoozedUntil: undefined }))
})

describe('daysUnclarified', () => {
  it('counts whole days', () =>
    expect(daysUnclarified({ createdAt: '2026-10-29T10:00:00+01:00' }, new Date('2026-11-21T09:00:00+01:00'))).toBe(22))
  it('does not round up at 23h59', () =>
    expect(daysUnclarified({ createdAt: '2026-11-20T10:01:00+01:00' }, new Date('2026-11-21T10:00:00+01:00'))).toBe(0))
  it('returns 0 for a future createdAt', () =>
    expect(daysUnclarified({ createdAt: '2026-11-25T10:00:00+01:00' }, now)).toBe(0))
})

describe('30-day cap for favourites', () => {
  it('caps → at 30 days for a favourite', () => {
    const patch = moreOftenPatch(makeQuote({ favorite: true, reviewIntervalDays: 27 }), now)
    expect(patch).toMatchObject({ reviewIntervalDays: 30, nextReviewAt: reviewDateFromInterval(30, now) })
  })
  it('keeps growing → for a non-favourite', () =>
    expect(moreOftenPatch(makeQuote({ reviewIntervalDays: 27 }), now).reviewIntervalDays).toBe(41))
  it('caps ← at 30 days for a favourite coming from a high interval', () => {
    const patch = lessOftenPatch(makeQuote({ favorite: true, reviewIntervalDays: 200 }), now)
    expect(patch).toMatchObject({ reviewIntervalDays: 30, nextReviewAt: reviewDateFromInterval(30, now) })
  })
  it('still applies the 14-day minimum of ← below the cap', () =>
    expect(lessOftenPatch(makeQuote({ favorite: true, reviewIntervalDays: 1 }), now).reviewIntervalDays).toBe(14))
  it('derives the interval for a legacy favourite without stored interval', () => {
    const patch = moreOftenPatch(makeQuote({ favorite: true, reviewCount: 9, reviewIntervalDays: undefined }), now)
    expect(patch.reviewIntervalDays).toBe(11)
  })
  it('leaves rest and wake untouched for a favourite', () => {
    expect(restPatch(makeQuote({ favorite: true, reviewIntervalDays: 90 }), now)).not.toHaveProperty('reviewIntervalDays')
    expect(wakePatch(makeQuote({ favorite: true, status: 'rest' }), now).reviewIntervalDays).toBe(1)
  })
})

describe('favoriteTogglePatch', () => {
  const far = new Date('2027-03-01T06:00:00+01:00').toISOString()
  it('pulls a far-away review in to 30 days at 06:00 and caps the interval', () => {
    const patch = favoriteTogglePatch(makeQuote({ favorite: false, reviewIntervalDays: 120, nextReviewAt: far }), now)
    expect(patch).toMatchObject({
      favorite: true,
      reviewIntervalDays: 30,
      nextReviewAt: reviewDateFromInterval(30, now),
      updatedAt: now.toISOString()
    })
  })
  it('leaves a review that is already within 30 days alone', () => {
    const soon = reviewDateFromInterval(10, now)
    const patch = favoriteTogglePatch(makeQuote({ reviewIntervalDays: 10, nextReviewAt: soon }), now)
    expect(patch).toEqual({ favorite: true, updatedAt: now.toISOString() })
  })
  it('caps a stored interval above 30 even when the due date is near', () => {
    const patch = favoriteTogglePatch(makeQuote({ reviewIntervalDays: 90, nextReviewAt: reviewDateFromInterval(5, now) }), now)
    expect(patch).toMatchObject({ favorite: true, reviewIntervalDays: 30 })
    expect(patch).not.toHaveProperty('nextReviewAt')
  })
  it('only sets the flag on rest and inbox entries, where due dates do not matter', () => {
    for (const status of ['rest', 'inbox'] as const) {
      const patch = favoriteTogglePatch(makeQuote({ status, reviewIntervalDays: 120, nextReviewAt: far }), now)
      expect(patch).toEqual({ favorite: true, updatedAt: now.toISOString() })
    }
  })
  it('unfavouriting changes nothing else', () => {
    const patch = favoriteTogglePatch(makeQuote({ favorite: true, reviewIntervalDays: 120, nextReviewAt: far }), now)
    expect(patch).toEqual({ favorite: false, updatedAt: now.toISOString() })
  })
})

describe('effectiveDueAt', () => {
  const far = new Date('2027-03-01T06:00:00+01:00').toISOString()
  it('caps a legacy favourite signal at 30 days after its last review, 06:00 local', () => {
    const lastReviewedAt = new Date('2026-10-21T12:00:00+02:00').toISOString()
    const due = effectiveDueAt(makeQuote({ favorite: true, status: 'signal', lastReviewedAt, nextReviewAt: far }))
    expect(due).toBe(new Date('2026-11-20T06:00:00+01:00').toISOString())
  })
  it('falls back to createdAt when the favourite was never reviewed', () => {
    const due = effectiveDueAt(makeQuote({ favorite: true, createdAt: '2026-10-01T12:00:00+02:00', nextReviewAt: far }))
    expect(due).toBe(new Date('2026-10-31T06:00:00+01:00').toISOString())
  })
  it('keeps an earlier stored date', () => {
    const near = reviewDateFromInterval(5, now)
    expect(effectiveDueAt(makeQuote({ favorite: true, lastReviewedAt: now.toISOString(), nextReviewAt: near }))).toBe(near)
  })
  it('does not cap non-favourites or non-signals', () => {
    expect(effectiveDueAt(makeQuote({ nextReviewAt: far }))).toBe(far)
    expect(effectiveDueAt(makeQuote({ favorite: true, status: 'rest', nextReviewAt: far }))).toBe(far)
  })
  it('is undefined without a stored date', () => expect(effectiveDueAt(makeQuote({ favorite: true }))).toBeUndefined())
})

describe('invalid stored dates', () => {
  it('reviewDateFromInterval falls back to today for an invalid base date', () => {
    expect(() => reviewDateFromInterval(1, new Date('foo'))).not.toThrow()
    expect(Number.isFinite(Date.parse(reviewDateFromInterval(1, new Date('foo'))))).toBe(true)
  })
  it('reviewDateFromInterval never throws for a non-finite interval', () => {
    expect(() => reviewDateFromInterval(Number.NaN, now)).not.toThrow()
    expect(() => reviewDateFromInterval(Number.POSITIVE_INFINITY, now)).not.toThrow()
  })
  it('effectiveDueAt treats an invalid nextReviewAt as due now (undefined)', () => {
    expect(effectiveDueAt(makeQuote({ nextReviewAt: 'foo' }))).toBeUndefined()
    expect(effectiveDueAt(makeQuote({ favorite: true, nextReviewAt: 'foo' }))).toBeUndefined()
  })
  it('effectiveDueAt does not throw for a favourite with invalid lastReviewedAt or createdAt', () => {
    const far = new Date('2099-03-01T06:00:00+01:00').toISOString()
    const quote = makeQuote({ favorite: true, lastReviewedAt: 'foo', createdAt: 'bar', nextReviewAt: far })
    expect(() => effectiveDueAt(quote)).not.toThrow()
    expect(Number.isFinite(Date.parse(effectiveDueAt(quote) as string))).toBe(true)
  })
  it('daysUnclarified is 0 for an invalid createdAt', () =>
    expect(daysUnclarified({ createdAt: 'foo' }, now)).toBe(0))
})
