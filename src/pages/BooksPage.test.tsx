import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, getBook, listBooks, upsertBooks, upsertQuotes } from '../db/database'
import { translations } from '../i18n/translations'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { makeBook, makeQuote, resetFactories } from '../test/factories'
import { renderWithProviders } from '../test/render'
import { BooksPage } from './BooksPage'

const en = translations.en

beforeEach(async () => {
  resetFactories()
  await db.delete()
  await db.open()
  useQuoteStore.setState({ quotes: [], loading: true })
  useBookStore.setState({ books: [], loading: true })
})

describe('BooksPage merge', () => {
  it('carries the strongest stored weight of the duplicates over to the primary book', async () => {
    // Arrange
    await upsertBooks([
      makeBook({
        id: 'primary',
        title: 'Meditations',
        author: 'Marcus Aurelius',
        weight: 'rare',
        createdAt: '2026-01-01T00:00:00.000Z'
      }),
      makeBook({
        id: 'dup',
        title: 'Meditations',
        author: 'Marcus Aurelius',
        weight: 'often',
        createdAt: '2026-02-01T00:00:00.000Z'
      })
    ])
    await upsertQuotes([
      makeQuote({ id: 'q1', bookId: 'primary' }),
      makeQuote({ id: 'q2', bookId: 'primary' }),
      makeQuote({ id: 'q3', bookId: 'dup' })
    ])
    renderWithProviders(<BooksPage />)

    // Act
    fireEvent.click(await screen.findByRole('button', { name: en.mergeBooks }))

    // Assert
    // The page's own message marks the end of the merge, so no reload is still running when the next test resets the database.
    await screen.findByText(en.booksMerged.replace('{count}', '2'))
    expect(await listBooks()).toHaveLength(1)
    expect((await getBook('primary'))?.weight).toBe('often')
  })

  it('leaves the weight alone when no book carries one', async () => {
    // Arrange
    await upsertBooks([
      makeBook({
        id: 'primary',
        title: 'Meditations',
        author: 'Marcus Aurelius',
        createdAt: '2026-01-01T00:00:00.000Z'
      }),
      makeBook({ id: 'dup', title: 'Meditations', author: 'Marcus Aurelius', createdAt: '2026-02-01T00:00:00.000Z' })
    ])
    await upsertQuotes([makeQuote({ id: 'q1', bookId: 'primary' }), makeQuote({ id: 'q2', bookId: 'primary' })])
    renderWithProviders(<BooksPage />)

    // Act
    fireEvent.click(await screen.findByRole('button', { name: en.mergeBooks }))

    // Assert
    // The page's own message marks the end of the merge, so no reload is still running when the next test resets the database.
    await screen.findByText(en.booksMerged.replace('{count}', '2'))
    expect(await listBooks()).toHaveLength(1)
    expect(await getBook('primary')).not.toHaveProperty('weight')
  })
})
