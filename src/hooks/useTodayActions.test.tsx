import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  browsing?: boolean
}

function setup(props: Props) {
  const callbacks = { advanceIndex: vi.fn(), hideQuote: vi.fn(), showQuote: vi.fn() }
  const hook = renderHook(
    (current: Props) => ({
      actions: useTodayActions({ currentQuote: current.quote, currentBook: current.book, browsing: current.browsing ?? false, ...callbacks }),
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

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useTodayActions', () => {
  it('tut ohne oberste Karte nichts', async () => {
    // Arrange
    const { result, callbacks } = setup({})

    // Act
    await act(async () => {
      result.current.actions.handleMoreOften()
      result.current.actions.handleLessOften()
      result.current.actions.handleRest()
      result.current.actions.openThought()
      result.current.actions.handleContextDiscard()
      result.current.actions.handleOpenDetails()
      await result.current.actions.handleFavoriteToggle()
    })

    // Assert
    expect(callbacks.advanceIndex).not.toHaveBeenCalled()
    expect(callbacks.hideQuote).not.toHaveBeenCalled()
    expect(useToastStore.getState().toast).toBeNull()
    expect(result.current.path).toBe('/')
    expect(result.current.actions.thoughtOpen).toBe(false)
  })

  it('stellt über → häufiger, rückt vor und zeigt den neuen Abstand, ohne doppelt zu liken', async () => {
    // Arrange
    const quote = makeQuote({ id: 'q', reviewIntervalDays: 3, likes: 0, reviewCount: 0 })
    await upsertQuotes([quote])
    await useQuoteStore.getState().loadQuotes()
    const { result, callbacks } = setup({ quote })

    // Act
    await act(async () => {
      await result.current.actions.handleMoreOften()
    })

    // Assert
    expect(callbacks.advanceIndex).toHaveBeenCalledTimes(1)
    expect(useToastStore.getState().toast?.message).toBe('Comes back in 5 days')
    const stored = await getQuote('q')
    expect(stored?.reviewIntervalDays).toBe(5)
    expect(stored?.likes).toBe(1)
    expect(stored?.reviewCount).toBe(1)
  })

  it('stellt über ← seltener, rückt vor und zeigt den neuen Abstand', async () => {
    // Arrange
    const quote = makeQuote({ id: 'q', reviewIntervalDays: 3 })
    await upsertQuotes([quote])
    await useQuoteStore.getState().loadQuotes()
    const { result, callbacks } = setup({ quote })

    // Act
    await act(async () => {
      await result.current.actions.handleLessOften()
    })

    // Assert
    expect(callbacks.advanceIndex).toHaveBeenCalledTimes(1)
    expect(useToastStore.getState().toast?.message).toBe('Comes back in 14 days')
    expect((await getQuote('q'))?.reviewIntervalDays).toBe(14)
  })

  it('zeigt keinen Intervall-Toast, wenn der Store keinen Abstand liefert', async () => {
    // Arrange
    const quote = makeQuote({ id: 'q' })
    vi.spyOn(useQuoteStore.getState(), 'moreOften').mockResolvedValue(undefined)
    const { result, callbacks } = setup({ quote })

    // Act
    await act(async () => {
      await result.current.actions.handleMoreOften()
    })

    // Assert
    expect(callbacks.advanceIndex).toHaveBeenCalledTimes(1)
    expect(useToastStore.getState().toast).toBeNull()
  })

  it.each([
    ['moreOften', 'handleMoreOften'],
    ['lessOften', 'handleLessOften']
  ] as const)('zeigt einen Fehler-Toast, wenn %s scheitert', async (storeAction, handler) => {
    // Arrange
    const quote = makeQuote({ id: 'q' })
    vi.spyOn(useQuoteStore.getState(), storeAction).mockRejectedValue(new Error('Schreibfehler'))
    const { result } = setup({ quote })

    // Act
    await act(async () => {
      await result.current.actions[handler]()
    })

    // Assert
    expect(useToastStore.getState().toast?.message).toBe(en.saveFailed)
  })

  it('lässt über ↓ ruhen: blendet sofort aus, ruht und rückt nicht vor', async () => {
    // Arrange
    const quote = makeQuote({ id: 'q', status: 'signal' })
    await upsertQuotes([quote])
    await useQuoteStore.getState().loadQuotes()
    const { result, callbacks } = setup({ quote })

    // Act
    await act(async () => {
      result.current.actions.handleRest()
    })

    // Assert
    expect(callbacks.hideQuote).toHaveBeenCalledWith('q')
    expect(callbacks.advanceIndex).not.toHaveBeenCalled()
    expect(useToastStore.getState().toast?.message).toBe(en.restedToast)
    expect(useToastStore.getState().toast?.actionLabel).toBe(en.undo)
    await waitFor(async () => expect((await getQuote('q'))?.status).toBe('rest'))
  })

  it('stellt eine ruhende Karte per Rückgängig mit dem früheren snoozedUntil wieder her', async () => {
    // Arrange
    const previous = '2030-01-01T06:00:00.000Z'
    const quote = makeQuote({ id: 'q', status: 'signal', snoozedUntil: previous })
    await upsertQuotes([quote])
    await useQuoteStore.getState().loadQuotes()
    const { result, callbacks } = setup({ quote })
    await act(async () => {
      result.current.actions.handleRest()
    })
    await waitFor(async () => expect((await getQuote('q'))?.status).toBe('rest'))
    const toast = useToastStore.getState().toast

    // Act
    await act(async () => {
      toast?.onAction?.()
    })

    // Assert
    expect(callbacks.showQuote).toHaveBeenCalledWith('q')
    await waitFor(async () => {
      const stored = await getQuote('q')
      expect(stored?.status).toBe('signal')
      expect(stored?.snoozedUntil).toBe(previous)
    })
  })

  describe('Rückgängig-Hinweis nach dem Ruhenlassen', () => {
    async function restThenAct(props: Props, next: (actions: ReturnType<typeof setup>['result']['current']['actions']) => void | Promise<unknown>) {
      const quote = makeQuote({ id: 'q', reviewIntervalDays: 3 })
      await upsertQuotes([quote])
      await useQuoteStore.getState().loadQuotes()
      const { result } = setup({ quote, ...props })
      await act(async () => result.current.actions.handleRest())
      expect(useToastStore.getState().toast?.actionLabel).toBe(en.undo)
      await act(async () => {
        await next(result.current.actions)
      })
    }

    it.each([
      ['→ in the daily deck', {}, (a: ReturnType<typeof setup>['result']['current']['actions']) => a.handleMoreOften()],
      ['← in the daily deck', {}, (a: ReturnType<typeof setup>['result']['current']['actions']) => a.handleLessOften()],
      ['→ while browsing', { browsing: true }, (a: ReturnType<typeof setup>['result']['current']['actions']) => a.handleMoreOften()],
      ['← while browsing', { browsing: true }, (a: ReturnType<typeof setup>['result']['current']['actions']) => a.handleLessOften()],
      ['↑ (thought)', {}, (a: ReturnType<typeof setup>['result']['current']['actions']) => a.openThought()]
    ])('is dismissed by the next deck action: %s', async (_name, props, next) => {
      // Arrange / Act
      await restThenAct(props, next)

      // Assert
      expect(useToastStore.getState().toast?.actionLabel).toBeUndefined()
    })
  })

  it('blendet die Karte wieder ein und zeigt einen Fehler, wenn das Ruhenlassen scheitert', async () => {
    // Arrange
    const quote = makeQuote({ id: 'q', status: 'signal' })
    await upsertQuotes([quote])
    vi.spyOn(useQuoteStore.getState(), 'restQuote').mockRejectedValue(new Error('Schreibfehler'))
    const { result, callbacks } = setup({ quote })

    // Act
    await act(async () => {
      result.current.actions.handleRest()
    })

    // Assert
    expect(callbacks.hideQuote).toHaveBeenCalledWith('q')
    await waitFor(() => expect(callbacks.showQuote).toHaveBeenCalledWith('q'))
    expect(useToastStore.getState().toast?.message).toBe(en.restFailed)
    expect((await getQuote('q'))?.status).toBe('signal')
  })

  it('öffnet und schließt den Gedanken-Zustand, ohne die Karte zu wechseln', () => {
    // Arrange
    const { result, callbacks } = setup({ quote: makeQuote({ id: 'q' }) })

    // Act
    act(() => result.current.actions.openThought())
    const opened = result.current.actions.thoughtOpen
    act(() => result.current.actions.closeThought())

    // Assert
    expect(opened).toBe(true)
    expect(result.current.actions.thoughtOpen).toBe(false)
    expect(callbacks.advanceIndex).not.toHaveBeenCalled()
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

  it('blendet die Karte wieder ein und zeigt einen Fehler, wenn das Verwerfen scheitert', async () => {
    // Arrange
    const quote = makeQuote({ id: 'q' })
    await upsertQuotes([quote])
    vi.spyOn(useQuoteStore.getState(), 'discardQuote').mockRejectedValue(new Error('Schreibfehler'))
    const { result, callbacks } = setup({ quote })

    // Act
    await act(async () => {
      result.current.actions.handleContextDiscard()
    })

    // Assert
    expect(callbacks.hideQuote).toHaveBeenCalledWith('q')
    await waitFor(() => expect(callbacks.showQuote).toHaveBeenCalledWith('q'))
    expect(useToastStore.getState().toast?.message).toBe(en.discardFailed)
    expect((await getQuote('q'))?.deletedAt).toBeUndefined()
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

  it('navigiert zur Detailseite der Karte', () => {
    // Arrange
    const { result } = setup({ quote: makeQuote({ id: 'q' }) })

    // Act
    act(() => result.current.actions.handleOpenDetails())

    // Assert
    expect(result.current.path).toBe('/quote/q')
  })

  it('schließt Menü, Gedanke und Buch-Editor, sobald eine andere Karte oben liegt', async () => {
    // Arrange
    const book = makeBook({ id: 'b', title: 'Buch', author: 'Autor' })
    const first = makeQuote({ id: 'q1', bookId: 'b' })
    const second = makeQuote({ id: 'q2', bookId: 'b' })
    const { result, rerender } = setup({ quote: first, book })
    act(() => result.current.actions.openBookEditor())
    act(() => result.current.actions.openContext())
    act(() => result.current.actions.openThought())

    // Act
    rerender({ quote: second, book })

    // Assert
    expect(result.current.actions.contextOpen).toBe(false)
    expect(result.current.actions.thoughtOpen).toBe(false)
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
