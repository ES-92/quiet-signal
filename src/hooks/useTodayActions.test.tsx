import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, getQuote, upsertQuotes } from '../db/database'
import { I18nProvider } from '../i18n/I18nProvider'
import { translations } from '../i18n/translations'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { useToastStore } from '../store/useToastStore'
import { makeQuote, resetFactories } from '../test/factories'
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
  browsing?: boolean
}

function setup(props: Props) {
  const callbacks = { advanceIndex: vi.fn(), rewindTo: vi.fn(), hideQuote: vi.fn(), showQuote: vi.fn() }
  const hook = renderHook(
    (current: Props) => ({
      actions: useTodayActions({ currentQuote: current.quote, browsing: current.browsing ?? false, ...callbacks }),
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

  it.each([
    ['handleMoreOften', { reviewIntervalDays: 3, likes: 2 }],
    ['handleLessOften', { reviewIntervalDays: 93, likes: 2 }]
  ] as const)('macht %s per Rückgängig exakt rückgängig und holt die Karte zurück', async (handler, seed) => {
    // Arrange
    const quote = makeQuote({
      id: 'q',
      ...seed,
      reviewCount: 4,
      lastReviewedAt: '2026-01-02T08:00:00.000Z',
      nextReviewAt: '2026-01-05T06:00:00.000Z'
    })
    await upsertQuotes([quote])
    await useQuoteStore.getState().loadQuotes()
    const { result, callbacks } = setup({ quote })
    await act(async () => {
      await result.current.actions[handler]()
    })
    const toast = useToastStore.getState().toast
    expect(toast?.actionLabel).toBe(en.undo)
    expect((await getQuote('q'))?.reviewCount).toBe(5)

    // Act
    await act(async () => {
      toast?.onAction?.()
    })

    // Assert
    expect(callbacks.rewindTo).toHaveBeenCalledExactlyOnceWith('q')
    await waitFor(async () => {
      const stored = await getQuote('q')
      expect(stored).toMatchObject({
        reviewIntervalDays: seed.reviewIntervalDays,
        nextReviewAt: '2026-01-05T06:00:00.000Z',
        reviewCount: 4,
        lastReviewedAt: '2026-01-02T08:00:00.000Z',
        likes: 2
      })
    })
  })

  it('stellt beim Rückgängig auch fehlende Werte (Altdaten ohne Abstand und Prüfdatum) wieder her', async () => {
    // Arrange
    const quote = makeQuote({ id: 'q', reviewCount: 2 })
    await upsertQuotes([quote])
    await useQuoteStore.getState().loadQuotes()
    const { result } = setup({ quote })
    await act(async () => {
      await result.current.actions.handleMoreOften()
    })

    // Act
    await act(async () => {
      useToastStore.getState().toast?.onAction?.()
    })

    // Assert
    await waitFor(async () => {
      const stored = await getQuote('q')
      expect(stored?.reviewIntervalDays).toBeUndefined()
      expect(stored?.nextReviewAt).toBeUndefined()
      expect(stored?.lastReviewedAt).toBeUndefined()
      expect(stored?.reviewCount).toBe(2)
    })
  })

  it('zeigt beim Stöbern keinen Toast und damit kein Rückgängig', async () => {
    // Arrange
    const quote = makeQuote({ id: 'q', reviewIntervalDays: 3 })
    const { result } = setup({ quote, browsing: true })

    // Act
    await act(async () => {
      await result.current.actions.handleMoreOften()
      await result.current.actions.handleLessOften()
    })

    // Assert
    expect(useToastStore.getState().toast).toBeNull()
  })

  it('ändert beim Stöbern weder Likes, Abstände, Status noch Aktivität und blättert nur weiter', async () => {
    // Arrange
    const quote = makeQuote({ id: 'q', reviewIntervalDays: 3, nextReviewAt: '2026-03-01T05:00:00.000Z' })
    await upsertQuotes([quote])
    await useQuoteStore.getState().loadQuotes()
    const { result, callbacks } = setup({ quote, browsing: true })

    // Act
    await act(async () => {
      await result.current.actions.handleMoreOften()
      await result.current.actions.handleLessOften()
      result.current.actions.handleRest()
      result.current.actions.handleContextDiscard()
    })

    // Assert
    const stored = await getQuote('q')
    expect(stored).toMatchObject({ status: 'signal', reviewIntervalDays: 3, nextReviewAt: '2026-03-01T05:00:00.000Z' })
    expect(stored?.likes ?? 0).toBe(0)
    expect(stored?.activity).toBeUndefined()
    expect(stored?.deletedAt).toBeUndefined()
    expect(callbacks.advanceIndex).toHaveBeenCalledTimes(2)
    expect(callbacks.hideQuote).not.toHaveBeenCalled()
    expect(useToastStore.getState().toast).toBeNull()
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
    const older = { at: '2026-01-01T09:00:00.000Z', type: 'rest' as const }
    const quote = makeQuote({ id: 'q', status: 'signal', snoozedUntil: previous, activity: [older] })
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
      expect(stored?.activity).toEqual([older])
    })
  })

  it('blendet die Karte wieder aus und meldet einen Fehler, wenn das Rückgängig-Speichern scheitert', async () => {
    // Arrange
    const quote = makeQuote({ id: 'q', status: 'signal' })
    await upsertQuotes([quote])
    await useQuoteStore.getState().loadQuotes()
    const { result, callbacks } = setup({ quote })
    const { undoRest } = useQuoteStore.getState()
    act(() => {
      useQuoteStore.setState({ undoRest: () => Promise.reject(new Error('boom')) })
    })
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
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe(en.saveFailed))
    useQuoteStore.setState({ undoRest })
    expect(callbacks.hideQuote).toHaveBeenCalledTimes(2)
    expect(callbacks.hideQuote).toHaveBeenLastCalledWith('q')
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
      ['↑ (thought)', {}, (a: ReturnType<typeof setup>['result']['current']['actions']) => a.openThought()]
    ])('is dismissed by the next deck action: %s', async (_name, props, next) => {
      // Arrange / Act
      await restThenAct(props, next)

      // Assert: the rest toast is gone (→/← may leave their own interval toast with its own undo).
      expect(useToastStore.getState().toast?.message).not.toBe(en.restedToast)
    })

    it('is dismissed by ↑ (thought) without leaving another toast', async () => {
      // Arrange / Act
      await restThenAct({}, (a) => a.openThought())

      // Assert
      expect(useToastStore.getState().toast).toBeNull()
    })
  })

  it('lässt einen späten Abstands-Toast von → nicht den Ruhen-Toast einer neueren Karte überschreiben', async () => {
    // Arrange
    const a = makeQuote({ id: 'a', reviewIntervalDays: 3 })
    const b = makeQuote({ id: 'b', reviewIntervalDays: 3 })
    await upsertQuotes([a, b])
    await useQuoteStore.getState().loadQuotes()
    const { result, rerender } = setup({ quote: a })
    let pendingA: Promise<void> | undefined

    // Act
    await act(async () => {
      pendingA = result.current.actions.handleMoreOften()
      rerender({ quote: b })
      result.current.actions.handleRest()
      await pendingA
    })

    // Assert
    expect(useToastStore.getState().toast?.message).toBe(en.restedToast)
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
    useQuoteStore.setState({ quotes: [quote] })
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

  it('schließt Menü und Gedanke, sobald eine andere Karte oben liegt', async () => {
    // Arrange
    const first = makeQuote({ id: 'q1' })
    const second = makeQuote({ id: 'q2' })
    const { result, rerender } = setup({ quote: first })
    act(() => result.current.actions.openContext())
    act(() => result.current.actions.openThought())

    // Act
    rerender({ quote: second })

    // Assert
    expect(result.current.actions.contextOpen).toBe(false)
    expect(result.current.actions.thoughtOpen).toBe(false)
  })
})
