import { beforeEach, describe, expect, it } from 'vitest'
import { makeQuote, resetFactories } from '../test/factories'
import {
  addThoughtPatch,
  adoptNotePatch,
  editThoughtPatch,
  removeThoughtPatch,
  restoreThoughtPatch,
  thoughtsNewestFirst
} from './thoughts'

const now = new Date('2026-11-21T10:00:00.000Z')

beforeEach(() => resetFactories())

describe('addThoughtPatch', () => {
  it('returns null for empty or whitespace text', () => {
    // Arrange
    const quote = makeQuote()

    // Act
    const empty = addThoughtPatch(quote, '', now)
    const blank = addThoughtPatch(quote, '   \n', now)

    // Assert
    expect(empty).toBeNull()
    expect(blank).toBeNull()
  })

  it('appends a trimmed thought with id and date and keeps existing ones', () => {
    // Arrange
    const existing = { id: 't0', text: 'old', createdAt: '2026-11-01T00:00:00.000Z' }
    const quote = makeQuote({ thoughts: [existing] })

    // Act
    const patch = addThoughtPatch(quote, '  new one ', now)

    // Assert
    expect(patch?.thoughts).toHaveLength(2)
    expect(patch?.thoughts?.[0]).toEqual(existing)
    expect(patch?.thoughts?.[1]).toMatchObject({ text: 'new one', createdAt: now.toISOString() })
    expect(patch?.thoughts?.[1].id).toBeTruthy()
    expect(patch?.thoughts?.[1]).not.toHaveProperty('fromNote')
    expect(patch?.updatedAt).toBe(now.toISOString())
  })

  it('marks the thought with fromNote when requested', () => {
    // Arrange
    const quote = makeQuote()

    // Act
    const patch = addThoughtPatch(quote, 'x', now, { fromNote: true })

    // Assert
    expect(patch?.thoughts?.[0].fromNote).toBe(true)
  })
})

describe('editThoughtPatch', () => {
  it('returns null for empty text', () => {
    // Arrange
    const quote = makeQuote({ thoughts: [{ id: 't1', text: 'a', createdAt: 'c' }] })

    // Act
    const patch = editThoughtPatch(quote, 't1', '  ', now)

    // Assert
    expect(patch).toBeNull()
  })

  it('changes text but keeps createdAt and other thoughts', () => {
    // Arrange
    const quote = makeQuote({
      thoughts: [
        { id: 't1', text: 'a', createdAt: '2026-11-01T00:00:00.000Z' },
        { id: 't2', text: 'b', createdAt: '2026-11-02T00:00:00.000Z' }
      ]
    })

    // Act
    const patch = editThoughtPatch(quote, 't1', ' changed ', now)

    // Assert
    expect(patch?.thoughts).toEqual([
      { id: 't1', text: 'changed', createdAt: '2026-11-01T00:00:00.000Z' },
      { id: 't2', text: 'b', createdAt: '2026-11-02T00:00:00.000Z' }
    ])
    expect(patch?.updatedAt).toBe(now.toISOString())
  })
})

describe('removeThoughtPatch', () => {
  it('removes only the given thought', () => {
    // Arrange
    const quote = makeQuote({
      thoughts: [
        { id: 't1', text: 'a', createdAt: 'c1' },
        { id: 't2', text: 'b', createdAt: 'c2' }
      ]
    })

    // Act
    const patch = removeThoughtPatch(quote, 't1', now)

    // Assert
    expect(patch.thoughts).toEqual([{ id: 't2', text: 'b', createdAt: 'c2' }])
    expect(patch.updatedAt).toBe(now.toISOString())
  })
})

describe('restoreThoughtPatch', () => {
  const t1 = { id: 't1', text: 'a', createdAt: '2026-01-01T10:00:00.000Z' }
  const t2 = { id: 't2', text: 'b', createdAt: '2026-01-02T10:00:00.000Z' }
  const t3 = { id: 't3', text: 'c', createdAt: '2026-01-03T10:00:00.000Z', fromNote: true }

  it('re-inserts the thought keeping chronological order', () => {
    // Arrange
    const quote = makeQuote({ thoughts: [t1, t3] })

    // Act
    const patch = restoreThoughtPatch(quote, t2, now)

    // Assert
    expect(patch.thoughts).toEqual([t1, t2, t3])
    expect(patch.updatedAt).toBe(now.toISOString())
  })

  it('keeps the original id, text, date and fromNote flag', () => {
    // Arrange
    const quote = makeQuote({ thoughts: [t1] })

    // Act
    const patch = restoreThoughtPatch(quote, t3, now)

    // Assert
    expect(patch.thoughts?.[1]).toEqual(t3)
  })

  it('does not duplicate a thought that is already present', () => {
    // Arrange
    const quote = makeQuote({ thoughts: [t1, t2] })

    // Act
    const patch = restoreThoughtPatch(quote, t2, now)

    // Assert
    expect(patch.thoughts).toEqual([t1, t2])
  })
})

describe('adoptNotePatch', () => {
  it('returns null without text', () => {
    // Arrange
    const quote = makeQuote({ text: '  ', note: 'n' })

    // Act
    const patch = adoptNotePatch(quote, now)

    // Assert
    expect(patch).toBeNull()
  })

  it('returns null without note', () => {
    // Arrange
    const withEmpty = makeQuote({ note: '   ' })
    const withNone = makeQuote({ note: undefined })

    // Act
    const a = adoptNotePatch(withEmpty, now)
    const b = adoptNotePatch(withNone, now)

    // Assert
    expect(a).toBeNull()
    expect(b).toBeNull()
  })

  it('turns the note into a fromNote thought and clears the note', () => {
    // Arrange
    const quote = makeQuote({ note: ' my note ' })

    // Act
    const patch = adoptNotePatch(quote, now)

    // Assert
    expect(patch?.thoughts?.[0]).toMatchObject({ text: 'my note', createdAt: now.toISOString(), fromNote: true })
    expect(patch).toHaveProperty('note', undefined)
  })
})

describe('thoughtsNewestFirst', () => {
  it('sorts by createdAt descending without mutating', () => {
    // Arrange
    const thoughts = [
      { id: 'a', text: 'a', createdAt: '2026-11-01T00:00:00.000Z' },
      { id: 'c', text: 'c', createdAt: '2026-11-03T00:00:00.000Z' },
      { id: 'b', text: 'b', createdAt: '2026-11-02T00:00:00.000Z' }
    ]

    // Act
    const sorted = thoughtsNewestFirst({ thoughts })

    // Assert
    expect(sorted.map((t) => t.id)).toEqual(['c', 'b', 'a'])
    expect(thoughts.map((t) => t.id)).toEqual(['a', 'c', 'b'])
  })

  it('returns an empty list when there are no thoughts', () => {
    // Arrange / Act
    const sorted = thoughtsNewestFirst({})

    // Assert
    expect(sorted).toEqual([])
  })
})
