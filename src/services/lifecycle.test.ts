import { describe, expect, it } from 'vitest'
import { makeQuote } from '../test/factories'
import {
  daysUnclarified,
  effectiveInterval,
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
