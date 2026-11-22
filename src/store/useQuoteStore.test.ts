import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, listQuotes, upsertQuotes } from '../db/database'
import { disableEncryptionRecord, enableEncryption, lockEncryption } from '../services/security'
import type { ReviewSnapshot } from '../services/lifecycle'
import { resetPersistentStorageRequest } from '../services/persistentStorage'
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

describe('loadQuotes', () => {
  it('meldet nach dem ersten Laden bei weiteren Ladevorgängen nie wieder loading', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'a', text: 'Eins' })])
    useQuoteStore.setState({ quotes: [], loading: true })
    const states: boolean[] = []
    const unsubscribe = useQuoteStore.subscribe((state) => states.push(state.loading))

    // Act
    await useQuoteStore.getState().loadQuotes()
    await useQuoteStore.getState().loadQuotes()
    unsubscribe()

    // Assert
    expect(useQuoteStore.getState().quotes).toHaveLength(1)
    expect(states.length).toBeGreaterThan(0)
    expect(states.every((loading) => loading === false)).toBe(true)
  })
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

  it('reports the previous review values of the changed row and restores them exactly', async () => {
    // Arrange
    await seedLegacyQuote({ likes: 3, lastReviewedAt: '2026-01-02T08:00:00.000Z', nextReviewAt: '2026-01-03T06:00:00.000Z' })
    let previous: ReviewSnapshot | undefined
    await useQuoteStore.getState().moreOften('legacy', (snapshot) => {
      previous = snapshot
    })

    // Act
    await useQuoteStore.getState().restoreReview('legacy', previous as ReviewSnapshot)

    // Assert
    expect(previous).toEqual({
      reviewIntervalDays: undefined,
      nextReviewAt: '2026-01-03T06:00:00.000Z',
      reviewCount: 2,
      lastReviewedAt: '2026-01-02T08:00:00.000Z',
      likes: 3
    })
    expect(useQuoteStore.getState().quotes[0]).toMatchObject({ reviewCount: 2, likes: 3, nextReviewAt: '2026-01-03T06:00:00.000Z' })
    expect(useQuoteStore.getState().quotes[0].reviewIntervalDays).toBeUndefined()
  })

  it('logs →, ↓, wake and a thought in the activity log, encrypted with the entry', async () => {
    // Arrange
    await enableEncryption('passwort-123')
    await seedLegacyQuote()

    // Act
    await useQuoteStore.getState().moreOften('legacy')
    await useQuoteStore.getState().restQuote('legacy')
    await useQuoteStore.getState().wakeQuote('legacy')
    await useQuoteStore.getState().addThought('legacy', 'Gedanke')
    const raw = await db.quotes.get('legacy')

    // Assert
    expect(useQuoteStore.getState().quotes[0].activity?.map((event) => event.type)).toEqual(['more', 'rest', 'wake', 'thought'])
    expect(raw?.encrypted).toBe(true)
    expect(raw).not.toHaveProperty('activity')
    expect(JSON.stringify(raw)).not.toContain('"more"')
  })

  it('restoreReview drops the more event of the undone →', async () => {
    // Arrange
    await seedLegacyQuote()
    let previous: ReviewSnapshot | undefined
    await useQuoteStore.getState().moreOften('legacy', (snapshot) => {
      previous = snapshot
    })
    await useQuoteStore.getState().addThought('legacy', 'bleibt')

    // Act
    await useQuoteStore.getState().restoreReview('legacy', previous as ReviewSnapshot)

    // Assert
    expect(useQuoteStore.getState().quotes[0].activity?.map((event) => event.type)).toEqual(['thought'])
  })

  it('undoRest puts the entry back and drops the rest event restQuote reported', async () => {
    // Arrange
    await seedLegacyQuote({ snoozedUntil: '2026-01-05T05:00:00.000Z' })
    const restedAt = await useQuoteStore.getState().restQuote('legacy')

    // Act
    await useQuoteStore.getState().undoRest('legacy', '2026-01-05T05:00:00.000Z', restedAt)

    // Assert
    expect(useQuoteStore.getState().quotes[0]).toMatchObject({ status: 'signal', snoozedUntil: '2026-01-05T05:00:00.000Z', activity: [] })
  })

  it('undoRest returns a rested inbox entry to the inbox when asked to', async () => {
    // Arrange
    await seedLegacyQuote({ status: 'inbox', snoozedUntil: '2026-01-05T05:00:00.000Z' })
    const restedAt = await useQuoteStore.getState().restQuote('legacy')
    const rested = useQuoteStore.getState().quotes[0].status

    // Act
    await useQuoteStore.getState().undoRest('legacy', '2026-01-05T05:00:00.000Z', restedAt, 'inbox')

    // Assert
    expect(rested).toBe('rest')
    expect(useQuoteStore.getState().quotes[0]).toMatchObject({ status: 'inbox', snoozedUntil: '2026-01-05T05:00:00.000Z', activity: [] })
  })

  it('logs rest and wake when the status changes through saveQuote (edit form)', async () => {
    // Arrange
    await seedLegacyQuote({ status: 'signal' })

    // Act
    await useQuoteStore.getState().saveQuote('legacy', { status: 'rest' })
    await useQuoteStore.getState().saveQuote('legacy', { status: 'signal', text: 'neu' })
    await useQuoteStore.getState().saveQuote('legacy', { text: 'nur Text' })

    // Assert
    expect(useQuoteStore.getState().quotes[0].activity?.map((event) => event.type)).toEqual(['rest', 'wake'])
  })

  it('does not log a browse-mode like', async () => {
    // Arrange
    await seedLegacyQuote()

    // Act
    await useQuoteStore.getState().likeQuote('legacy')
    await useQuoteStore.getState().loadQuotes()

    // Assert
    expect(useQuoteStore.getState().quotes[0].activity).toBeUndefined()
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

  it('adoptNote returns the id of the adopted thought and undoAdoptNote removes only that thought', async () => {
    // Arrange
    const other = { id: 'other', text: 'bleibt', createdAt: '2026-11-01T00:00:00.000Z' }
    await seedLegacyQuote({ note: 'remember this', thoughts: [other] })
    const adoptedId = await useQuoteStore.getState().adoptNote('legacy')
    await useQuoteStore.getState().addThought('legacy', 'spaeter')

    // Act
    await useQuoteStore.getState().undoAdoptNote('legacy', adoptedId as string, 'remember this')

    // Assert
    const quote = useQuoteStore.getState().quotes[0]
    expect(adoptedId).toEqual(expect.any(String))
    expect(quote.note).toBe('remember this')
    expect(quote.thoughts?.map((item) => item.text)).toEqual(['bleibt', 'spaeter'])
  })

  it('updater actions reject when the row cannot be read, so callers can show an error', async () => {
    // Arrange
    await seedLegacyQuote()
    await db.quotes.delete('legacy')

    // Act / Assert
    await expect(useQuoteStore.getState().restQuote('legacy')).rejects.toThrow('Quote not found or unreadable')
    await expect(useQuoteStore.getState().addThought('legacy', 'x')).rejects.toThrow('Quote not found or unreadable')
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

  it('toggleFavorite pulls a far-away review in to 30 days and caps the interval', async () => {
    // Arrange
    await seedLegacyQuote({ reviewIntervalDays: 120, nextReviewAt: '2027-06-01T06:00:00.000Z' })

    // Act
    await useQuoteStore.getState().toggleFavorite('legacy')

    // Assert
    const stored = await db.quotes.get('legacy')
    expect(stored?.favorite).toBe(true)
    expect(stored?.reviewIntervalDays).toBe(30)
    expect(new Date(stored?.nextReviewAt as string).getTime()).toBeLessThanOrEqual(Date.now() + 31 * 24 * 60 * 60 * 1000)
    expect(useQuoteStore.getState().quotes[0].favorite).toBe(true)
  })

  it('toggleFavorite off leaves the schedule alone', async () => {
    // Arrange
    await seedLegacyQuote({ favorite: true, reviewIntervalDays: 120, nextReviewAt: '2027-06-01T06:00:00.000Z' })

    // Act
    await useQuoteStore.getState().toggleFavorite('legacy')

    // Assert
    const stored = await db.quotes.get('legacy')
    expect(stored).toMatchObject({ favorite: false, reviewIntervalDays: 120, nextReviewAt: '2027-06-01T06:00:00.000Z' })
  })

  it('toggleFavorite ignores unknown ids', async () => {
    // Arrange
    await seedLegacyQuote()

    // Act
    await useQuoteStore.getState().toggleFavorite('missing')

    // Assert
    expect((await db.quotes.get('legacy'))?.favorite).toBe(false)
  })

  it('saveQuote with favorite true applies the cap once, and not again when already a favourite', async () => {
    // Arrange
    await seedLegacyQuote({ reviewIntervalDays: 120, nextReviewAt: '2027-06-01T06:00:00.000Z' })

    // Act
    await useQuoteStore.getState().saveQuote('legacy', { favorite: true })
    const capped = await db.quotes.get('legacy')
    await db.quotes.update('legacy', { reviewIntervalDays: 90, nextReviewAt: '2027-06-01T06:00:00.000Z' })
    await useQuoteStore.getState().saveQuote('legacy', { favorite: true })
    const again = await db.quotes.get('legacy')

    // Assert
    expect(capped?.reviewIntervalDays).toBe(30)
    expect(again?.reviewIntervalDays).toBe(90)
    expect(again?.nextReviewAt).toBe('2027-06-01T06:00:00.000Z')
  })
})

describe('dauerhafter Speicher', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'storage', { value: undefined, configurable: true })
  })

  it('bittet nach dem ersten erfolgreichen Speichern um dauerhaften Speicher', async () => {
    // Arrange
    resetPersistentStorageRequest()
    const persist = vi.fn().mockResolvedValue(true)
    Object.defineProperty(navigator, 'storage', { value: { persist }, configurable: true })
    await useQuoteStore.getState().loadQuotes()
    expect(persist).not.toHaveBeenCalled()

    // Act
    await useQuoteStore.getState().addQuote({ text: 'Erster', tags: [], favorite: false, status: 'inbox' } as never)

    // Assert
    expect(persist).toHaveBeenCalledTimes(1)
  })
})

describe('addQuote bei fehlschlagendem Neuladen', () => {
  afterEach(() => vi.restoreAllMocks())

  it('meldet Erfolg, wenn nur das Neuladen nach dem Speichern scheitert', async () => {
    // Arrange
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const orderBy = vi.spyOn(db.quotes, 'orderBy').mockImplementationOnce(() => {
      throw new Error('reload failed')
    })

    // Act
    const created = await useQuoteStore.getState().addQuote({ text: 'Gespeichert', tags: [], favorite: false, status: 'inbox' } as never)

    // Assert
    expect(created.text).toBe('Gespeichert')
    expect(orderBy).toHaveBeenCalled()
    orderBy.mockRestore()
    expect((await listQuotes()).map((quote) => quote.text)).toEqual(['Gespeichert'])
  })

  it('wirft weiterhin, wenn das Speichern selbst scheitert', async () => {
    vi.spyOn(db.quotes, 'add').mockRejectedValueOnce(new Error('QuotaExceededError'))
    await expect(
      useQuoteStore.getState().addQuote({ text: 'x', tags: [], favorite: false, status: 'inbox' } as never)
    ).rejects.toThrow('QuotaExceededError')
  })
})
