import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, getQuote, upsertBooks, upsertQuotes } from '../db/database'
import { I18nProvider } from '../i18n/I18nProvider'
import { translations } from '../i18n/translations'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { useToastStore } from '../store/useToastStore'
import { makeBook, makeQuote, resetFactories } from '../test/factories'
import type { Book } from '../types/book'
import type { Quote } from '../types/quote'
import { useTodayActions } from './useTodayActions'

const en = translations.en
const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>
    <I18nProvider>{children}</I18nProvider>
  </MemoryRouter>
)

interface Props {
  quote?: Quote
  book?: Book
}

function setup(props: Props) {
  const callbacks = { advanceIndex: vi.fn(), hideQuote: vi.fn(), showQuote: vi.fn() }
  const hook = renderHook(
    (current: Props) => ({
      actions: useTodayActions({ currentQuote: current.quote, currentBook: current.book, ...callbacks }),
      path: useLocation().pathname
    }),
    { wrapper, initialProps: props }
  )
  return { ...hook, callbacks }
}

beforeEach(async () => {
  resetFactories()
  await db.delete()
  await db.open()
  useQuoteStore.setState({ quotes: [], loading: true })
  useBookStore.setState({ books: [], loading: true })
  useToastStore.setState({ toast: null })
})

describe('useTodayActions', () => {
  it('tut ohne oberste Karte nichts', async () => {
    // Arrange
    const { result, callbacks } = setup({})

    // Act
    await act(async () => {
      result.current.actions.handleKeep()
      result.current.actions.handleSnooze()
      result.current.actions.handleDiscard()
      result.current.actions.handleContextSnooze()
      result.current.actions.handleContextDiscard()
      result.current.actions.handleDislike()
      result.current.actions.handleOpenDetails()
      await result.current.actions.handleFavoriteToggle()
    })

    // Assert
    expect(callbacks.advanceIndex).not.toHaveBeenCalled()
    expect(callbacks.hideQuote).not.toHaveBeenCalled()
    expect(useToastStore.getState().toast).toBeNull()
    expect(result.current.path).toBe('/')
  })

  it('behält eine Karte mit Like und Wiederholung und rückt vor', async () => {
    // Arrange
    const quote = makeQuote({ id: 'q' })
    await upsertQuotes([quote])
    await useQuoteStore.getState().loadQuotes()
    const { result, callbacks } = setup({ quote })

    // Act
    await act(async () => {
      result.current.actions.handleKeep()
    })

    // Assert
    expect(callbacks.advanceIndex).toHaveBeenCalledTimes(1)
    await waitFor(async () => {
      const stored = await getQuote('q')
      expect(stored?.likes).toBe(1)
      expect(stored?.reviewCount).toBe(1)
    })
  })

  it('stellt per Wisch zurück, speichert und rückt vor', async () => {
    // Arrange
    const quote = makeQuote({ id: 'q' })
    await upsertQuotes([quote])
    const { result, callbacks } = setup({ quote })

    // Act
    await act(async () => {
      result.current.actions.handleSnooze()
    })

    // Assert
    expect(callbacks.advanceIndex).toHaveBeenCalledTimes(1)
    await waitFor(async () => expect((await getQuote('q'))?.snoozedUntil).toBeTruthy())
  })

  it('verwirft ohne Vorrücken, blendet aus und bietet Rückgängig an, das die Karte wiederherstellt', async () => {
    // Arrange
    const quote = makeQuote({ id: 'q' })
    await upsertQuotes([quote])
    const { result, callbacks } = setup({ quote })

    // Act
    await act(async () => {
      result.current.actions.handleDiscard()
    })
    const toast = useToastStore.getState().toast
    await waitFor(async () => expect((await getQuote('q'))?.deletedAt).toBeTruthy())
    await act(async () => {
      toast?.onAction?.()
    })

    // Assert
    expect(callbacks.hideQuote).toHaveBeenCalledWith('q')
    expect(callbacks.advanceIndex).not.toHaveBeenCalled()
    expect(toast?.message).toBe(en.discardedToast)
    expect(toast?.actionLabel).toBe(en.undo)
    expect(callbacks.showQuote).toHaveBeenCalledWith('q')
    await waitFor(async () => expect((await getQuote('q'))?.deletedAt).toBeUndefined())
  })

  it('verwirft über das Kontextmenü, schließt das Menü und rückt nicht vor', async () => {
    // Arrange
    const quote = makeQuote({ id: 'q' })
    await upsertQuotes([quote])
    const { result, callbacks } = setup({ quote })
    act(() => result.current.actions.openContext())

    // Act
    await act(async () => {
      result.current.actions.handleContextDiscard()
    })

    // Assert
    expect(result.current.actions.contextOpen).toBe(false)
    expect(callbacks.hideQuote).toHaveBeenCalledWith('q')
    expect(callbacks.advanceIndex).not.toHaveBeenCalled()
    expect(useToastStore.getState().toast?.message).toBe(en.discardedToast)
    await waitFor(async () => expect((await getQuote('q'))?.deletedAt).toBeTruthy())
  })

  it('stellt über das Kontextmenü zurück, schließt das Menü und rückt vor', async () => {
    // Arrange
    const quote = makeQuote({ id: 'q' })
    await upsertQuotes([quote])
    const { result, callbacks } = setup({ quote })
    act(() => result.current.actions.openContext())

    // Act
    await act(async () => {
      result.current.actions.handleContextSnooze()
    })

    // Assert
    expect(result.current.actions.contextOpen).toBe(false)
    expect(callbacks.advanceIndex).toHaveBeenCalledTimes(1)
    await waitFor(async () => expect((await getQuote('q'))?.snoozedUntil).toBeTruthy())
  })

  it('schaltet den Favoriten um und schließt das Menü', async () => {
    // Arrange
    const quote = makeQuote({ id: 'q', favorite: false })
    await upsertQuotes([quote])
    const { result } = setup({ quote })
    act(() => result.current.actions.openContext())

    // Act
    await act(async () => {
      await result.current.actions.handleFavoriteToggle()
    })

    // Assert
    expect((await getQuote('q'))?.favorite).toBe(true)
    expect(result.current.actions.contextOpen).toBe(false)
  })

  it('senkt die Likes über Dislike und schließt das Menü', async () => {
    // Arrange
    const quote = makeQuote({ id: 'q', likes: 2 })
    await upsertQuotes([quote])
    await useQuoteStore.getState().loadQuotes()
    const { result } = setup({ quote })
    act(() => result.current.actions.openContext())

    // Act
    await act(async () => {
      result.current.actions.handleDislike()
    })

    // Assert
    expect(result.current.actions.contextOpen).toBe(false)
    await waitFor(async () => expect((await getQuote('q'))?.likes).toBe(1))
  })

  it('navigiert zur Detailseite der Karte', () => {
    // Arrange
    const { result } = setup({ quote: makeQuote({ id: 'q' }) })

    // Act
    act(() => result.current.actions.handleOpenDetails())

    // Assert
    expect(result.current.path).toBe('/quote/q')
  })

  it('schließt Menü und Buch-Editor, sobald eine andere Karte oben liegt', async () => {
    // Arrange
    const book = makeBook({ id: 'b', title: 'Buch', author: 'Autor' })
    const first = makeQuote({ id: 'q1', bookId: 'b' })
    const second = makeQuote({ id: 'q2', bookId: 'b' })
    const { result, rerender } = setup({ quote: first, book })
    act(() => result.current.actions.openBookEditor())
    act(() => result.current.actions.openContext())

    // Act
    rerender({ quote: second, book })

    // Assert
    expect(result.current.actions.contextOpen).toBe(false)
    expect(result.current.actions.bookEditorOpen).toBe(false)
  })

  it('füllt den Buch-Editor aus dem Buch und öffnet ihn ohne Menü', () => {
    // Arrange
    const book = makeBook({ id: 'b', title: 'Buch', author: 'Autor' })
    const { result } = setup({ quote: makeQuote({ id: 'q', bookId: 'b' }), book })
    act(() => result.current.actions.openContext())

    // Act
    act(() => result.current.actions.openBookEditor())

    // Assert
    expect(result.current.actions.bookEditorOpen).toBe(true)
    expect(result.current.actions.contextOpen).toBe(false)
    expect(result.current.actions.bookTitle).toBe('Buch')
    expect(result.current.actions.bookAuthor).toBe('Autor')
  })

  it('speichert das Buch getrimmt und schließt den Editor, ignoriert aber einen leeren Titel', async () => {
    // Arrange
    const book = makeBook({ id: 'b', title: 'Buch' })
    await upsertBooks([book])
    await useBookStore.getState().loadBooks()
    const { result } = setup({ quote: makeQuote({ id: 'q', bookId: 'b' }), book })
    act(() => result.current.actions.openBookEditor())
    act(() => result.current.actions.setBookTitle('   '))
    await act(async () => {
      await result.current.actions.handleSaveBook()
    })
    const stillOpen = result.current.actions.bookEditorOpen
    act(() => result.current.actions.setBookTitle('  Neu '))
    act(() => result.current.actions.setBookAuthor(' Autorin '))

    // Act
    await act(async () => {
      await result.current.actions.handleSaveBook()
    })

    // Assert
    expect(stillOpen).toBe(true)
    expect(result.current.actions.bookEditorOpen).toBe(false)
    const stored = useBookStore.getState().books[0]
    expect(stored?.title).toBe('Neu')
    expect(stored?.author).toBe('Autorin')
  })
})
