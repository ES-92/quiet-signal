import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, upsertBooks, upsertQuotes } from '../db/database'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { makeBook, makeQuote, resetFactories } from '../test/factories'
import { useInboxQueue } from './useInboxQueue'

beforeEach(async () => {
  resetFactories()
  await db.delete()
  await db.open()
  useQuoteStore.setState({ quotes: [], loading: true })
  useBookStore.setState({ books: [], loading: true })
})

describe('useInboxQueue', () => {
  it('lädt beim Einhängen und liefert nur Eingangseinträge, älteste zuerst, samt Büchern', async () => {
    // Arrange
    await upsertQuotes([
      makeQuote({ id: 'n', text: 'Neu', status: 'inbox', createdAt: '2026-01-02T09:00:00.000Z' }),
      makeQuote({ id: 'a', text: 'Alt', status: 'inbox', createdAt: '2026-01-01T09:00:00.000Z' }),
      makeQuote({ id: 's', text: 'Signal', status: 'signal' })
    ])
    await upsertBooks([makeBook({ id: 'b' })])

    // Act
    const { result } = renderHook(() => useInboxQueue())

    // Assert
    await waitFor(() => expect(result.current.inboxQuotes.map((quote) => quote.id)).toEqual(['a', 'n']))
    await waitFor(() => expect(result.current.books.map((book) => book.id)).toEqual(['b']))
  })

  it('stellt kürzlich abgelaufene Rückstellungen nach vorn und blendet noch laufende aus', async () => {
    // Arrange
    await upsertQuotes([
      makeQuote({ id: 'fifo', status: 'inbox', createdAt: '2026-01-01T09:00:00.000Z' }),
      makeQuote({
        id: 'wach',
        status: 'inbox',
        createdAt: '2026-01-05T09:00:00.000Z',
        snoozedUntil: '2000-01-01T08:00:00.000Z'
      }),
      makeQuote({ id: 'schlaeft', status: 'inbox', snoozedUntil: '2999-01-01T08:00:00.000Z' })
    ])

    // Act
    const { result } = renderHook(() => useInboxQueue())

    // Assert
    await waitFor(() => expect(result.current.inboxQuotes.map((quote) => quote.id)).toEqual(['wach', 'fifo']))
  })
})
