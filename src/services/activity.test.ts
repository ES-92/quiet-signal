import { describe, expect, it } from 'vitest'
import { makeQuote } from '../test/factories'
import type { ActivityEvent } from '../types/quote'
import { appendActivity, maxActivityEvents, normalizeActivity, removeLatestActivity } from './activity'
import { lessOftenPatch, moreOftenPatch, restoreReviewPatch, restPatch, reviewSnapshot, statusActivityPatch, undoRestPatch, wakePatch } from './lifecycle'
import { addThoughtPatch, adoptNotePatch } from './thoughts'

const now = new Date('2026-11-21T15:00:00+01:00')
const at = now.toISOString()

describe('appendActivity', () => {
  it('appends an event with the timestamp and type', () => {
    // Arrange
    const existing: ActivityEvent[] = [{ at: '2026-11-20T10:00:00.000Z', type: 'rest' }]

    // Act
    const result = appendActivity(existing, 'more', now)

    // Assert
    expect(result).toEqual([...existing, { at, type: 'more' }])
    expect(existing).toHaveLength(1)
  })

  it('starts a log for a legacy entry without one', () => {
    // Act
    const result = appendActivity(undefined, 'thought', now)

    // Assert
    expect(result).toEqual([{ at, type: 'thought' }])
  })

  it('keeps only the last 200 events', () => {
    // Arrange
    const full: ActivityEvent[] = Array.from({ length: maxActivityEvents }, (_, index) => ({
      at: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
      type: 'more' as const
    }))

    // Act
    const result = appendActivity(full, 'rest', now)

    // Assert
    expect(maxActivityEvents).toBe(200)
    expect(result).toHaveLength(200)
    expect(result[0]).toEqual(full[1])
    expect(result[199]).toEqual({ at, type: 'rest' })
  })
})

describe('removeLatestActivity', () => {
  it('removes only the newest matching event', () => {
    // Arrange
    const log: ActivityEvent[] = [
      { at: '2026-11-19T10:00:00.000Z', type: 'rest' },
      { at: '2026-11-20T10:00:00.000Z', type: 'thought' },
      { at: '2026-11-21T10:00:00.000Z', type: 'rest' }
    ]

    // Act
    const result = removeLatestActivity(log, (event) => event.type === 'rest')

    // Assert
    expect(result).toEqual(log.slice(0, 2))
  })

  it('leaves the log alone without a match', () => {
    // Arrange
    const log: ActivityEvent[] = [{ at: '2026-11-20T10:00:00.000Z', type: 'thought' }]

    // Act / Assert
    expect(removeLatestActivity(log, (event) => event.type === 'more')).toEqual(log)
    expect(removeLatestActivity(undefined, () => true)).toBeUndefined()
  })
})

describe('normalizeActivity (import)', () => {
  it('keeps valid events and turns parseable dates into ISO', () => {
    // Act
    const result = normalizeActivity([
      { at: '2026-11-20T10:00:00+01:00', type: 'more' },
      { at: 'kein-datum', type: 'rest' },
      { at: '2026-11-20T11:00:00Z', type: 'explode' },
      { at: 42, type: 'less' },
      null,
      'text',
      { at: '2026-11-21T08:00:00Z', type: 'wake', extra: 'weg' }
    ])

    // Assert
    expect(result).toEqual([
      { at: '2026-11-20T09:00:00.000Z', type: 'more' },
      { at: '2026-11-21T08:00:00.000Z', type: 'wake' }
    ])
  })

  it('returns undefined for anything but an array', () => {
    expect(normalizeActivity(undefined)).toBeUndefined()
    expect(normalizeActivity('more')).toBeUndefined()
    expect(normalizeActivity({ at: at, type: 'more' })).toBeUndefined()
  })

  it('sorts an imported log by date before keeping the newest 200', () => {
    // Arrange
    const newest = { at: '2026-12-31T10:00:00.000Z', type: 'wake' }
    const many = Array.from({ length: 200 }, (_, index) => ({ at: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(), type: 'more' }))
    const oldest = { at: '2025-01-01T00:00:00.000Z', type: 'rest' }

    // Act
    const result = normalizeActivity([newest, ...many, oldest])

    // Assert
    expect(result).toHaveLength(200)
    expect(result?.[199]).toEqual(newest)
    expect(result?.some((event) => event.at === oldest.at)).toBe(false)
    expect(result?.[0].at).toBe(many[1].at)
  })

  it('caps an imported log to the last 200 events', () => {
    // Arrange
    const many = Array.from({ length: 250 }, (_, index) => ({ at: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(), type: 'more' }))

    // Act
    const result = normalizeActivity(many)

    // Assert
    expect(result).toHaveLength(200)
    expect(result?.[0].at).toBe(many[50].at)
  })
})

describe('lifecycle patches log activity', () => {
  it('→ logs more, ← logs less, rest logs rest, wake logs wake', () => {
    // Arrange
    const quote = makeQuote({ activity: [{ at: '2026-11-01T10:00:00.000Z', type: 'thought' }] })

    // Act / Assert
    expect(moreOftenPatch(quote, now).activity).toEqual([...quote.activity!, { at, type: 'more' }])
    expect(lessOftenPatch(quote, now).activity).toEqual([...quote.activity!, { at, type: 'less' }])
    expect(restPatch(quote, now).activity).toEqual([...quote.activity!, { at, type: 'rest' }])
    expect(wakePatch(quote, now).activity).toEqual([...quote.activity!, { at, type: 'wake' }])
  })

  it('undo of → removes the more event it created and keeps later thoughts', () => {
    // Arrange
    const before = makeQuote({ reviewIntervalDays: 3 })
    const after = { ...before, ...moreOftenPatch(before, now) }
    const withThought = { ...after, ...addThoughtPatch(after, 'später', new Date('2026-11-21T15:05:00+01:00')) }

    // Act
    const patch = restoreReviewPatch(withThought, reviewSnapshot(before), now)

    // Assert
    expect(patch.activity?.map((event) => event.type)).toEqual(['thought'])
    expect(patch.reviewIntervalDays).toBe(3)
  })

  it('undo of ← removes the less event it created', () => {
    // Arrange
    const before = makeQuote({ activity: [{ at: '2026-11-01T10:00:00.000Z', type: 'more' }] })
    const after = { ...before, ...lessOftenPatch(before, now) }

    // Act
    const patch = restoreReviewPatch(after, reviewSnapshot(before), now)

    // Assert
    expect(patch.activity).toEqual(before.activity)
  })

  it('undo of rest puts the snooze back and removes exactly the rest event it created', () => {
    // Arrange
    const older = { at: '2026-11-20T10:00:00.000Z', type: 'rest' as const }
    const before = makeQuote({ snoozedUntil: '2026-11-22T05:00:00.000Z', activity: [older] })
    const rested = { ...before, ...restPatch(before, now) }
    const later = { ...rested, activity: [...rested.activity!, { at: '2026-11-21T14:30:00.000Z', type: 'rest' as const }] }

    // Act
    const patch = undoRestPatch(later, before.snoozedUntil, at, now)

    // Assert
    expect(patch).toMatchObject({ status: 'signal', snoozedUntil: '2026-11-22T05:00:00.000Z' })
    expect(patch.activity).toEqual([older, { at: '2026-11-21T14:30:00.000Z', type: 'rest' }])
  })

  it('a status change in the edit form logs rest and wake, nothing else', () => {
    // Arrange
    const signal = makeQuote({ status: 'signal' })
    const resting = makeQuote({ status: 'rest' })
    const inbox = makeQuote({ status: 'inbox' })

    // Act / Assert
    expect(statusActivityPatch(signal, 'rest', now)).toEqual({ activity: [{ at, type: 'rest' }] })
    expect(statusActivityPatch(resting, 'signal', now)).toEqual({ activity: [{ at, type: 'wake' }] })
    expect(statusActivityPatch(inbox, 'signal', now)).toEqual({})
    expect(statusActivityPatch(resting, 'rest', now)).toEqual({})
    expect(statusActivityPatch(signal, undefined, now)).toEqual({})
  })
})

describe('thought patches log activity', () => {
  it('adding a thought logs a thought event', () => {
    // Act
    const patch = addThoughtPatch(makeQuote(), 'Ein Gedanke', now)

    // Assert
    expect(patch?.activity).toEqual([{ at, type: 'thought' }])
  })

  it('adopting an old note is not logged as a new thought', () => {
    // Act
    const patch = adoptNotePatch(makeQuote({ note: 'alt' }), now)

    // Assert
    expect(patch).not.toHaveProperty('activity')
  })
})
