import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, upsertQuotes } from '../db/database'
import { disableEncryptionRecord, enableEncryption, lockEncryption } from '../services/security'
import { makeQuote, resetFactories } from '../test/factories'
import { useQuoteStore } from './useQuoteStore'

// PBKDF2 is slow; raise the timeout for this file only.
vi.setConfig({ testTimeout: 30000 })

beforeEach(async () => {
  resetFactories()
  await db.delete()
  await db.open()
  useQuoteStore.setState({ quotes: [] })
})

afterEach(() => {
  lockEncryption()
  disableEncryptionRecord()
})

async function seedLegacyQuote(overrides = {}) {
  // Legacy record: no reviewIntervalDays and no thoughts; reviewCount 2 derives an interval of 7.
  const quote = makeQuote({ id: 'legacy', reviewCount: 2, ...overrides })
  await upsertQuotes([quote])
  await useQuoteStore.getState().loadQuotes()
  return quote
}

describe('lifecycle store actions', () => {
  it('moreOften returns the new interval and persists it in an encrypted row', async () => {
    // Arrange
    await enableEncryption('passwort-123')
    await seedLegacyQuote({ text: 'Plain secret text' })

    // Act
    const interval = await useQuoteStore.getState().moreOften('legacy')
    await useQuoteStore.getState().loadQuotes()
    const loaded = useQuoteStore.getState().quotes.find((q) => q.id === 'legacy')
    const raw = await db.quotes.get('legacy')

    // Assert
    expect(interval).toBe(11)
    expect(loaded?.reviewIntervalDays).toBe(11)
    expect(raw?.encrypted).toBe(true)
    expect(raw).not.toHaveProperty('thoughts')
    expect(raw).not.toHaveProperty('reviewIntervalDays')
    expect(JSON.stringify(raw)).not.toContain('Plain secret text')
  })

  it('stores thoughts only inside the encrypted payload under an active vault', async () => {
    // Arrange
    await enableEncryption('passwort-123')
    await seedLegacyQuote()

    // Act
    await useQuoteStore.getState().addThought('legacy', 'Secret thought')
    const raw = await db.quotes.get('legacy')

    // Assert
    expect(raw?.encrypted).toBe(true)
    expect(raw).not.toHaveProperty('thoughts')
    expect(JSON.stringify(raw)).not.toContain('Secret thought')
    expect(useQuoteStore.getState().quotes[0].thoughts?.[0].text).toBe('Secret thought')
  })

  it('keeps both thoughts when addThought is called twice without awaiting', async () => {
    // Arrange
    await seedLegacyQuote()

    // Act
    await Promise.all([
      useQuoteStore.getState().addThought('legacy', 'A'),
      useQuoteStore.getState().addThought('legacy', 'B')
    ])

    // Assert
    const texts = (await db.quotes.get('legacy'))?.thoughts?.map((t) => t.text)
    expect(texts).toEqual(['A', 'B'])
  })

  it('applies two concurrent moreOften calls on top of each other', async () => {
    // Arrange
    await seedLegacyQuote({ reviewIntervalDays: 1, reviewCount: 0 })

    // Act
    await Promise.all([useQuoteStore.getState().moreOften('legacy'), useQuoteStore.getState().moreOften('legacy')])

    // Assert
    const row = await db.quotes.get('legacy')
    expect(row?.reviewCount).toBe(2)
    expect(row?.reviewIntervalDays).toBe(3)
  })

  it('lessOften returns the new interval', async () => {
    // Arrange
    await seedLegacyQuote()

    // Act
    const interval = await useQuoteStore.getState().lessOften('legacy')

    // Assert
    expect(interval).toBe(28)
    expect(useQuoteStore.getState().quotes[0].reviewIntervalDays).toBe(28)
  })

  it('returns undefined and writes nothing for an unknown id', async () => {
    // Arrange
    await seedLegacyQuote()

    // Act
    const more = await useQuoteStore.getState().moreOften('missing')
    const less = await useQuoteStore.getState().lessOften('missing')

    // Assert
    expect(more).toBeUndefined()
    expect(less).toBeUndefined()
    expect((await db.quotes.get('legacy'))?.reviewCount).toBe(2)
  })

  it('restQuote sets status rest', async () => {
    // Arrange
    await seedLegacyQuote()

    // Act
    await useQuoteStore.getState().restQuote('legacy')

    // Assert
    expect(useQuoteStore.getState().quotes[0].status).toBe('rest')
  })

  it('wakeQuote sets status signal with interval 1', async () => {
    // Arrange
    await seedLegacyQuote({ status: 'rest' })

    // Act
    await useQuoteStore.getState().wakeQuote('legacy')

    // Assert
    const quote = useQuoteStore.getState().quotes[0]
    expect(quote.status).toBe('signal')
    expect(quote.reviewIntervalDays).toBe(1)
  })

  it('addThought persists the thought across reload', async () => {
    // Arrange
    await seedLegacyQuote()

    // Act
    await useQuoteStore.getState().addThought('legacy', '  first  ')
    await useQuoteStore.getState().addThought('legacy', '   ')
    await useQuoteStore.getState().loadQuotes()

    // Assert
    const thoughts = useQuoteStore.getState().quotes[0].thoughts
    expect(thoughts).toHaveLength(1)
    expect(thoughts?.[0].text).toBe('first')
  })

  it('editThought and removeThought update the stored thoughts', async () => {
    // Arrange
    await seedLegacyQuote({
      thoughts: [
        { id: 't1', text: 'a', createdAt: '2026-11-01T00:00:00.000Z' },
        { id: 't2', text: 'b', createdAt: '2026-11-02T00:00:00.000Z' }
      ]
    })

    // Act
    await useQuoteStore.getState().editThought('legacy', 't1', 'a2')
    await useQuoteStore.getState().removeThought('legacy', 't2')

    // Assert
    expect(useQuoteStore.getState().quotes[0].thoughts).toEqual([
      { id: 't1', text: 'a2', createdAt: '2026-11-01T00:00:00.000Z' }
    ])
  })

  it('restoreThought re-inserts a removed thought in order', async () => {
    // Arrange
    const first = { id: 't1', text: 'a', createdAt: '2026-11-01T00:00:00.000Z' }
    const second = { id: 't2', text: 'b', createdAt: '2026-11-02T00:00:00.000Z', fromNote: true }
    await seedLegacyQuote({ thoughts: [first, second] })
    await useQuoteStore.getState().removeThought('legacy', 't1')

    // Act
    await useQuoteStore.getState().restoreThought('legacy', first)

    // Assert
    expect(useQuoteStore.getState().quotes[0].thoughts).toEqual([first, second])
  })

  it('adoptNote moves the note into a fromNote thought', async () => {
    // Arrange
    await seedLegacyQuote({ note: 'remember this' })

    // Act
    await useQuoteStore.getState().adoptNote('legacy')

    // Assert
    const quote = useQuoteStore.getState().quotes[0]
    expect(quote.note).toBeUndefined()
    expect(quote.thoughts?.[0]).toMatchObject({ text: 'remember this', fromNote: true })
  })

  it('thought actions ignore unknown ids', async () => {
    // Arrange
    await seedLegacyQuote()

    // Act
    await useQuoteStore.getState().addThought('missing', 'x')
    await useQuoteStore.getState().adoptNote('missing')

    // Assert
    expect(await db.quotes.count()).toBe(1)
    expect(useQuoteStore.getState().quotes[0].thoughts).toBeUndefined()
  })
})
