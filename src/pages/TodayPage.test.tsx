import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, getQuote, listBooks, listQuotes, upsertBooks, upsertQuotes } from '../db/database'
import { translations } from '../i18n/translations'
import { coachKey } from '../services/coach'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { useToastStore } from '../store/useToastStore'
import { makeBook, makeQuote, resetFactories } from '../test/factories'
import { renderWithProviders } from '../test/render'
import { TodayPage } from './TodayPage'

const en = translations.en
const SLOW = { timeout: 3000 }
// Some tests replace addThought on the store; every test starts with the real one again.
const realAddThought = useQuoteStore.getState().addThought

const idByText: Record<string, string> = { Eins: 't-1', Zwei: 't-2', Drei: 't-3' }

async function seedStack() {
  await upsertQuotes([
    makeQuote({ id: 't-1', text: 'Eins' }),
    makeQuote({ id: 't-2', text: 'Zwei' }),
    makeQuote({ id: 't-3', text: 'Drei' })
  ])
}

// Waits until the page's mount-time loads are done, so no query is still running when the next test resets the database.
function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>
}

async function renderToday() {
  const result = renderWithProviders(
    <>
      <TodayPage />
      <LocationProbe />
    </>
  )
  await waitFor(() => {
    expect(useQuoteStore.getState().loading).toBe(false)
    expect(useBookStore.getState().loading).toBe(false)
  })
  return result
}

// A kept card is persisted asynchronously; wait until the store reflects it so nothing is pending at test end.
async function expectKeptCount(count: number) {
  await waitFor(() => expect(useQuoteStore.getState().quotes.filter((quote) => (quote.likes ?? 0) > 0)).toHaveLength(count), SLOW)
}

// Resting and its undo persist in the background (DB write, then a store reload). Waiting for the store to show the new status
// proves both are done, so no write or reload is still running when the next test resets the database and the stores.
async function expectStatusSettled(id: string, status: 'rest' | 'signal') {
  await waitFor(async () => {
    expect((await getQuote(id))?.status).toBe(status)
    expect(useQuoteStore.getState().quotes.find((quote) => quote.id === id)?.status).toBe(status)
  }, SLOW)
}

function currentText() {
  return (screen.getByRole('blockquote').textContent ?? '').replace(/"/g, '')
}

function currentId() {
  return idByText[currentText()]
}

function deckSurface() {
  return screen.getByRole('blockquote').closest('.deck-top-card')?.parentElement as HTMLElement
}

function swipe(dx: number, dy = 0) {
  const surface = deckSurface()
  fireEvent.pointerDown(surface, { pointerId: 1, clientX: 200, clientY: 300 })
  fireEvent.pointerMove(surface, { pointerId: 1, clientX: 200 + dx, clientY: 300 + dy })
  fireEvent.pointerUp(surface, { pointerId: 1, clientX: 200 + dx, clientY: 300 + dy })
}

async function longPress() {
  const surface = deckSurface()
  fireEvent.pointerDown(surface, { pointerId: 1, clientX: 200, clientY: 300 })
  await screen.findByText(en.contextActions, undefined, SLOW)
  fireEvent.pointerUp(surface, { pointerId: 1, clientX: 200, clientY: 300 })
}

function removeFromStore(id: string) {
  act(() => {
    useQuoteStore.setState((state) => ({ quotes: state.quotes.filter((quote) => quote.id !== id) }))
  })
}

beforeEach(async () => {
  resetFactories()
  await db.delete()
  await db.open()
  useQuoteStore.setState({ quotes: [], loading: true, addThought: realAddThought })
  useBookStore.setState({ books: [], loading: true })
  useToastStore.setState({ toast: null })
  localStorage.setItem(coachKey, 'true')
  // jsdom implements neither matchMedia/ResizeObserver (used by useFitText) nor pointer capture (used by the swipe deck).
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
})

describe('TodayPage', () => {
  it('zeigt den Leerzustand, wenn heute nichts fällig ist', async () => {
    // Arrange / Act
    await renderToday()

    // Assert
    expect(await screen.findByText(en.nothingDueToday)).toBeInTheDocument()
  })

  it('zeigt bei leerer Bibliothek den Hinweis auf Beispieldaten', async () => {
    // Arrange / Act
    await renderToday()

    // Assert
    expect(await screen.findByText(en.nothingDueBody)).toBeInTheDocument()
    expect(screen.queryByText(en.nothingDueBodyWithSignals)).not.toBeInTheDocument()
  })

  it('bietet bei völlig leerer Bibliothek „Mit Beispielen ausprobieren“ an und lädt die Beispieldaten', async () => {
    // Arrange
    await renderToday()

    // Act
    fireEvent.click(await screen.findByRole('button', { name: en.trySamples }))

    // Assert
    await waitFor(async () => expect((await listQuotes()).length).toBeGreaterThan(0), SLOW)
    expect((await listBooks()).length).toBeGreaterThan(0)
  })

  it('bietet die Beispiele nicht an, sobald die Bibliothek etwas enthält', async () => {
    // Arrange
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString()
    await upsertQuotes([makeQuote({ id: 't-1', text: 'Eins', nextReviewAt: future, reviewIntervalDays: 5, reviewCount: 2 })])

    // Act
    await renderToday()

    // Assert
    await screen.findByText(en.nothingDueBodyWithSignals)
    expect(screen.queryByRole('button', { name: en.trySamples })).not.toBeInTheDocument()
  })

  it('verweist bei vorhandenen Signalen nicht auf Beispieldaten, wenn heute nichts fällig ist', async () => {
    // Arrange
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString()
    await upsertQuotes([makeQuote({ id: 't-1', text: 'Eins', nextReviewAt: future, reviewIntervalDays: 5, reviewCount: 2 })])

    // Act
    await renderToday()

    // Assert
    expect(await screen.findByText(en.nothingDueBodyWithSignals)).toBeInTheDocument()
    expect(screen.queryByText(en.nothingDueBody)).not.toBeInTheDocument()
  })

  it('zeigt eine fällige Karte mit Fortschritt', async () => {
    // Arrange
    await seedStack()

    // Act
    await renderToday()

    // Assert
    await screen.findByRole('blockquote')
    expect(Object.keys(idByText)).toContain(currentText())
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
  })

  it('zeigt auf der Karte ein kleines Herz, wenn sie ein Favorit ist', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 't-1', text: 'Eins', favorite: true })])

    // Act
    await renderToday()

    // Assert
    expect(await screen.findByRole('img', { name: en.favorite })).toBeInTheDocument()
  })

  it('zeigt auf der Karte kein Herz, wenn sie kein Favorit ist', async () => {
    // Arrange
    await seedStack()

    // Act
    await renderToday()

    // Assert
    await screen.findByRole('blockquote')
    expect(screen.queryByRole('img', { name: en.favorite })).not.toBeInTheDocument()
  })

  it('geht per Wisch nach rechts zur nächsten Karte, stellt öfter und zeigt den Abstand', async () => {
    // Arrange
    await seedStack()
    await renderToday()
    await screen.findByRole('blockquote')
    const first = currentId()

    // Act
    swipe(160)

    // Assert
    await waitFor(() => expect(screen.getByText('2 of 3')).toBeInTheDocument(), SLOW)
    expect(currentId()).not.toBe(first)
    await waitFor(async () => expect((await getQuote(first))?.likes).toBe(1), SLOW)
    await expectKeptCount(1)
    expect(useToastStore.getState().toast?.message).toBe('Comes back in 2 days')
  })

  it('behält die Reihenfolge des Stapels, obwohl gelesene Karten aus der Auswahl fallen', async () => {
    // Arrange
    await seedStack()
    await renderToday()
    await screen.findByRole('blockquote')
    const seen = [currentText()]

    // Act
    swipe(160)
    await waitFor(() => expect(screen.getByText('2 of 3')).toBeInTheDocument(), SLOW)
    seen.push(currentText())
    swipe(160)
    await waitFor(() => expect(screen.getByText('3 of 3')).toBeInTheDocument(), SLOW)
    seen.push(currentText())
    await expectKeptCount(2)

    // Assert
    expect(new Set(seen).size).toBe(3)
  })

  it('öffnet per langem Drücken das Kontextmenü und schließt es wieder', async () => {
    // Arrange
    await seedStack()
    await renderToday()
    await screen.findByRole('blockquote')

    // Act
    await longPress()
    fireEvent.click(screen.getByRole('button', { name: en.close }))

    // Assert
    expect(screen.queryByText(en.contextActions)).not.toBeInTheDocument()
  })

  it('schließt das Kontextmenü, sobald eine andere Karte oben liegt', async () => {
    // Arrange
    await seedStack()
    await renderToday()
    await screen.findByRole('blockquote')
    await longPress()
    const first = currentText()

    // Act
    removeFromStore(currentId())

    // Assert
    await waitFor(() => expect(currentText()).not.toBe(first))
    expect(screen.queryByText(en.contextActions)).not.toBeInTheDocument()
  })

  it('behält beim Behalten einer Karte das Like dauerhaft', async () => {
    // Arrange
    await seedStack()
    await renderToday()
    await screen.findByRole('blockquote')
    const first = currentId()

    // Act
    swipe(160)
    await waitFor(() => expect(screen.getByText('2 of 3')).toBeInTheDocument(), SLOW)
    await expectKeptCount(1)
    await act(async () => {
      await useQuoteStore.getState().loadQuotes()
    })

    // Assert
    const stored = await getQuote(first)
    expect(stored?.likes).toBe(1)
    expect(useQuoteStore.getState().quotes.find((quote) => quote.id === first)?.likes).toBe(1)
  })

  it('zeigt nach dem Ruhenlassen per Wisch nach unten die nächste Karte statt die übernächste', async () => {
    // Arrange
    await seedStack()
    await renderToday()
    await screen.findByRole('blockquote')
    const first = currentText()
    const firstId = currentId()

    // Act
    swipe(0, 160)
    await waitFor(() => expect(currentText()).not.toBe(first), SLOW)

    // Assert
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
    await waitFor(async () => expect((await getQuote(firstId))?.status).toBe('rest'), SLOW)
  })

  it('zeigt nach dem Verwerfen über das Kontextmenü die nächste Karte statt die übernächste', async () => {
    // Arrange
    await seedStack()
    await renderToday()
    await screen.findByRole('blockquote')
    const first = currentText()
    await longPress()

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.deleteEntry }))
    await waitFor(() => expect(currentText()).not.toBe(first), SLOW)

    // Assert
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
    await waitFor(() => expect(useQuoteStore.getState().quotes).toHaveLength(2), SLOW)
  })

  it('blendet die ruhende Karte sofort aus, bevor das Speichern fertig ist', async () => {
    // Arrange
    await seedStack()
    await renderToday()
    await screen.findByRole('blockquote')
    const first = currentText()
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const realRest = useQuoteStore.getState().restQuote
    act(() => {
      useQuoteStore.setState({ restQuote: async (id) => { await gate; return realRest(id) } })
    })

    // Act
    swipe(0, 160)
    await waitFor(() => expect(currentText()).not.toBe(first), SLOW)

    // Assert
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
    expect(useQuoteStore.getState().quotes.every((quote) => quote.status !== 'rest')).toBe(true)
    release()
    await waitFor(() => expect(useQuoteStore.getState().quotes.some((quote) => quote.status === 'rest')).toBe(true), SLOW)
    expect(currentText()).not.toBe(first)
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
  })

  it('blendet die über das Kontextmenü verworfene Karte sofort aus', async () => {
    // Arrange
    await seedStack()
    await renderToday()
    await screen.findByRole('blockquote')
    const first = currentText()
    await longPress()
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const realDiscard = useQuoteStore.getState().discardQuote
    act(() => {
      useQuoteStore.setState({ discardQuote: async (id) => { await gate; await realDiscard(id) } })
    })

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.deleteEntry }))

    // Assert
    expect(currentText()).not.toBe(first)
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
    expect(useQuoteStore.getState().quotes).toHaveLength(3)
    release()
    await waitFor(() => expect(useQuoteStore.getState().quotes).toHaveLength(2), SLOW)
  })

  it('zeigt nach dem Ruhenlassen der letzten Karte den Abschlusszustand', async () => {
    // Arrange
    await seedStack()
    await renderToday()
    await screen.findByRole('blockquote')
    swipe(160)
    await waitFor(() => expect(screen.getByText('2 of 3')).toBeInTheDocument(), SLOW)
    swipe(160)
    await waitFor(() => expect(screen.getByText('3 of 3')).toBeInTheDocument(), SLOW)
    await expectKeptCount(2)

    // Act
    swipe(0, 160)

    // Assert
    await screen.findByText(en.doneForToday, undefined, SLOW)
    await waitFor(() => expect(useQuoteStore.getState().quotes.some((quote) => quote.status === 'rest')).toBe(true), SLOW)
  })

  it('beginnt nach einem leeren Stapel wieder bei der ersten neuen Karte', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 't-1', text: 'Eins' })])
    await renderToday()
    await screen.findByRole('blockquote')
    swipe(-160)
    await screen.findByText(en.doneForToday, undefined, SLOW)
    await waitFor(() => expect(useQuoteStore.getState().quotes[0]?.reviewIntervalDays).toBe(14), SLOW)

    // Act
    act(() => {
      useQuoteStore.setState({ quotes: [] })
    })
    act(() => {
      useQuoteStore.setState({ quotes: [makeQuote({ id: 't-9', text: 'Neu' })] })
    })

    // Assert
    expect(await screen.findByText('"Neu"')).toBeInTheDocument()
    expect(screen.getByText('1 of 1')).toBeInTheDocument()
  })

  it('zeigt den Gesten-Coach beim ersten Besuch und merkt sich das Schließen', async () => {
    // Arrange
    localStorage.removeItem(coachKey)
    await seedStack()
    await renderToday()

    // Act
    fireEvent.click(await screen.findByRole('button', { name: en.coachGotIt }))

    // Assert
    expect(screen.queryByRole('dialog', { name: en.gestures })).not.toBeInTheDocument()
    expect(localStorage.getItem(coachKey)).toBe('true')
  })

  it('zeigt den Gesten-Coach nicht, wenn er schon gesehen wurde', async () => {
    // Arrange
    await seedStack()

    // Act
    await renderToday()
    await screen.findByRole('blockquote')

    // Assert
    expect(screen.queryByRole('dialog', { name: en.gestures })).not.toBeInTheDocument()
  })

  it('setzt per Wisch nach oben den Gedanken-Zustand und lässt die Karte stehen', async () => {
    // Arrange
    await seedStack()
    await renderToday()
    await screen.findByRole('blockquote')

    const first = currentText()

    // Act
    swipe(0, -160)
    swipe(160)

    // Assert
    await waitFor(() => expect(currentText()).toBe(first), SLOW)
    expect(screen.queryByText(en.contextActions)).not.toBeInTheDocument()
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
  })

  it('stellt eine ruhende Karte über die Rückgängig-Aktion wieder her und zeigt sie wieder im Stapel', async () => {
    // Arrange
    await seedStack()
    await renderToday()
    await screen.findByRole('blockquote')
    const first = currentText()
    const firstId = currentId()
    swipe(0, 160)
    await waitFor(() => expect(currentText()).not.toBe(first), SLOW)
    await waitFor(async () => expect((await getQuote(firstId))?.status).toBe('rest'), SLOW)
    const toast = useToastStore.getState().toast

    // Act
    expect(toast?.message).toBe(en.restedToast)
    expect(toast?.actionLabel).toBe(en.undo)
    act(() => toast?.onAction?.())

    // Assert
    await waitFor(async () => expect((await getQuote(firstId))?.status).toBe('signal'), SLOW)
    await waitFor(() => expect(screen.getByText('1 of 3')).toBeInTheDocument(), SLOW)
    expect(currentText()).toBe(first)
  })

  it('holt per Rückgängig die Karte des Hinweises zurück, auch wenn danach weitere Karten bearbeitet wurden', async () => {
    // Arrange
    await seedStack()
    await renderToday()
    await screen.findByRole('blockquote')
    const first = currentId()
    swipe(160)
    await waitFor(() => expect(currentId()).not.toBe(first), SLOW)
    await waitFor(() => expect(useToastStore.getState().toast?.message).toMatch(/^Comes back in \d+ days$/), SLOW)
    const undoFirst = useToastStore.getState().toast
    const second = currentId()
    swipe(160)
    await waitFor(() => expect(currentId()).not.toBe(second), SLOW)
    await waitFor(() => expect(useToastStore.getState().toast?.message).toMatch(/^Comes back in \d+ days$/), SLOW)

    // Act
    act(() => undoFirst?.onAction?.())

    // Assert
    await waitFor(() => expect(currentId()).toBe(first), SLOW)
    await waitFor(async () => expect((await getQuote(first))?.reviewCount).toBe(0), SLOW)
  })

  it('stellt eine über das Kontextmenü gelöschte Karte per Rückgängig wieder her', async () => {
    // Arrange
    await seedStack()
    await renderToday()
    await screen.findByRole('blockquote')
    const first = currentText()
    const firstId = currentId()
    await longPress()
    fireEvent.click(screen.getByRole('button', { name: en.deleteEntry }))
    await waitFor(() => expect(currentText()).not.toBe(first), SLOW)
    await waitFor(() => expect(useQuoteStore.getState().quotes).toHaveLength(2), SLOW)
    const toast = useToastStore.getState().toast

    // Act
    expect(toast?.message).toBe(en.discardedToast)
    act(() => toast?.onAction?.())

    // Assert
    await waitFor(() => expect(useQuoteStore.getState().quotes).toHaveLength(3), SLOW)
    expect((await getQuote(firstId))?.deletedAt).toBeUndefined()
    await waitFor(() => expect(currentText()).toBe(first), SLOW)
  })

  it('markiert über das Kontextmenü einen Favoriten und schließt das Menü', async () => {
    // Arrange
    await seedStack()
    await renderToday()
    await screen.findByRole('blockquote')
    const first = currentId()
    await longPress()

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.favorite }))

    // Assert
    await waitFor(async () => expect((await getQuote(first))?.favorite).toBe(true), SLOW)
    await waitFor(() => expect(screen.queryByText(en.contextActions)).not.toBeInTheDocument())
  })

  it('öffnet über das Kontextmenü die Detailseite der Karte', async () => {
    // Arrange
    await seedStack()
    await renderToday()
    await screen.findByRole('blockquote')
    const first = currentId()
    await longPress()

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.openDetails }))

    // Assert
    expect(screen.getByTestId('location')).toHaveTextContent(`/quote/${first}`)
  })

  it('zeigt den Reflexions-Hinweis ab drei Gedanken dieser Woche und öffnet die Reflexionen', async () => {
    // Arrange
    const now = new Date().toISOString()
    const thought = (id: string) => ({ id, text: id, createdAt: now })
    await upsertQuotes([
      makeQuote({ id: 't-1', text: 'Eins', createdAt: now, updatedAt: now, thoughts: [thought('a')] }),
      makeQuote({ id: 't-2', text: 'Zwei', createdAt: now, updatedAt: now, thoughts: [thought('b')] }),
      makeQuote({ id: 't-3', text: 'Drei', createdAt: now, updatedAt: now, thoughts: [thought('c')] })
    ])
    await renderToday()
    await screen.findByRole('blockquote')

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.openReflections }))

    // Assert
    expect(screen.getByTestId('location')).toHaveTextContent('/reflections')
  })

  it('zeigt ohne genug Einträge keinen Reflexions-Hinweis und keinen Wisch-Hinweis, der dem Ruhen lassen widerspricht', async () => {
    // Arrange / Act
    await seedStack()
    await renderToday()
    await screen.findByRole('blockquote')

    // Assert
    expect(screen.queryByRole('button', { name: en.openReflections })).not.toBeInTheDocument()
    expect(screen.queryByText(/swipe down for noise/i)).not.toBeInTheDocument()
  })

  it('zeigt im Kontextmenü Favorit, Details und Löschen, aber weder Später noch Buch bearbeiten', async () => {
    // Arrange
    await upsertBooks([makeBook({ id: 'b-1', title: 'Das Buch' })])
    await upsertQuotes([makeQuote({ id: 't-1', text: 'Eins', bookId: 'b-1' })])
    await renderToday()
    await screen.findByRole('blockquote')

    // Act
    await longPress()

    // Assert
    for (const name of [en.favorite, en.openDetails, en.deleteEntry]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: en.later })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit book|buch bearbeiten/i })).not.toBeInTheDocument()
  })

  describe('Aktionsleiste', () => {
    it('hat eine eigene Werkzeugleiste mit Beschriftung, getrennt vom Erfassen-Dock', async () => {
      // Arrange
      await seedStack()

      // Act
      await renderToday()
      await screen.findByRole('blockquote')

      // Assert
      const toolbar = screen.getByRole('toolbar', { name: en.cardActionBar })
      expect(toolbar).toContainElement(screen.getByRole('button', { name: en.gestureRest }))
      expect(screen.getByLabelText(en.quickNoise)).not.toContainElement(toolbar)
    })

    it('zeigt unter den Symbolen sichtbare Kurzlabels Öfter, Gedanke, Seltener, Ruhen', async () => {
      // Arrange
      await seedStack()

      // Act
      await renderToday()
      await screen.findByRole('blockquote')

      // Assert
      const toolbar = within(screen.getByRole('toolbar', { name: en.cardActionBar }))
      expect(toolbar.getByRole('button', { name: en.gestureMoreOften })).toHaveTextContent(en.actionShortMore)
      expect(toolbar.getByRole('button', { name: en.gestureThought })).toHaveTextContent(en.actionShortThought)
      expect(toolbar.getByRole('button', { name: en.gestureLessOften })).toHaveTextContent(en.actionShortLess)
      expect(toolbar.getByRole('button', { name: en.gestureRest })).toHaveTextContent(en.actionShortRest)
      expect([en.actionShortMore, en.actionShortThought, en.actionShortLess, en.actionShortRest]).toEqual(['More', 'Thought', 'Less', 'Rest'])
    })

    it('macht gesperrte Schaltflächen sichtbar blasser', async () => {
      // Arrange
      await seedStack()
      await renderToday()
      await screen.findByRole('blockquote')

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.gestureThought }))

      // Assert
      const rest = screen.getByRole('button', { name: en.gestureRest })
      expect(rest).toBeDisabled()
      expect(rest).toHaveClass('disabled:opacity-40')
    })

    it('Öfter wirkt wie Wischen nach rechts', async () => {
      // Arrange
      await seedStack()
      await renderToday()
      await screen.findByRole('blockquote')
      const first = currentId()

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.gestureMoreOften }))

      // Assert
      await waitFor(() => expect(screen.getByText('2 of 3')).toBeInTheDocument(), SLOW)
      await waitFor(async () => expect((await getQuote(first))?.likes).toBe(1), SLOW)
      await waitFor(() => expect(useToastStore.getState().toast?.message).toBe('Comes back in 2 days'), SLOW)
    })

    it('Seltener wirkt wie Wischen nach links', async () => {
      // Arrange
      await seedStack()
      await renderToday()
      await screen.findByRole('blockquote')
      const first = currentId()

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.gestureLessOften }))

      // Assert
      await waitFor(() => expect(screen.getByText('2 of 3')).toBeInTheDocument(), SLOW)
      await waitFor(async () => expect((await getQuote(first))?.reviewIntervalDays).toBe(14), SLOW)
      await waitFor(() => expect(useToastStore.getState().toast?.message).toBe('Comes back in 14 days'), SLOW)
    })

    it('Gedanke lässt die Karte stehen und sperrt die Wischgesten', async () => {
      // Arrange
      await seedStack()
      await renderToday()
      await screen.findByRole('blockquote')
      const first = currentText()

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.gestureThought }))
      swipe(160)

      // Assert
      expect(currentText()).toBe(first)
      expect(screen.getByText('1 of 3')).toBeInTheDocument()
    })

    it('Gedanke öffnet das Sheet, speichert und lässt die Karte oben ohne Toast', async () => {
      // Arrange
      await seedStack()
      await renderToday()
      await screen.findByRole('blockquote')
      const first = currentText()
      const firstId = currentId()

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.gestureThought }))
      fireEvent.change(screen.getByPlaceholderText(en.thoughtPlaceholder), { target: { value: '  Mein Gedanke ' } })
      fireEvent.click(screen.getByRole('button', { name: en.save }))

      // Assert
      await waitFor(() => expect(screen.queryByPlaceholderText(en.thoughtPlaceholder)).not.toBeInTheDocument(), SLOW)
      expect((await getQuote(firstId))?.thoughts?.[0]?.text).toBe('Mein Gedanke')
      expect(currentText()).toBe(first)
      expect(screen.getByText('1 of 3')).toBeInTheDocument()
      expect(useToastStore.getState().toast).toBeNull()
      expect(await screen.findByText(/Mein Gedanke/)).toBeInTheDocument()
    })

    it('Gedanke: ein doppeltes Tippen auf Speichern legt den Gedanken nur einmal an', async () => {
      // Arrange
      await seedStack()
      await renderToday()
      await screen.findByRole('blockquote')
      let release: () => void = () => undefined
      const addThought = vi.fn(() => new Promise<void>((resolve) => (release = resolve)))
      act(() => {
        useQuoteStore.setState({ addThought })
      })
      fireEvent.click(screen.getByRole('button', { name: en.gestureThought }))
      fireEvent.change(screen.getByPlaceholderText(en.thoughtPlaceholder), { target: { value: 'Nur einmal' } })
      const save = screen.getByRole('button', { name: en.save })

      // Act: the second tap arrives while the first write is still running
      await act(async () => {
        fireEvent.click(save)
      })
      await act(async () => {
        fireEvent.click(save)
      })
      release()

      // Assert
      await waitFor(() => expect(screen.queryByPlaceholderText(en.thoughtPlaceholder)).not.toBeInTheDocument(), SLOW)
      expect(addThought).toHaveBeenCalledTimes(1)
    })

    it('Gedanke: bei Speicherfehler bleibt das Sheet mit Text offen und ein Fehler-Toast erscheint', async () => {
      // Arrange
      await seedStack()
      await renderToday()
      await screen.findByRole('blockquote')
      act(() => {
        useQuoteStore.setState({ addThought: () => Promise.reject(new Error('boom')) })
      })
      fireEvent.click(screen.getByRole('button', { name: en.gestureThought }))
      fireEvent.change(screen.getByPlaceholderText(en.thoughtPlaceholder), { target: { value: 'Bleibt' } })

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.save }))

      // Assert
      await waitFor(() => expect(useToastStore.getState().toast?.message).toBe(en.saveFailed), SLOW)
      expect(screen.getByPlaceholderText(en.thoughtPlaceholder)).toHaveValue('Bleibt')
    })

    it('sperrt die Leiste, solange Sheet, Kontextmenü oder Gesten-Coach offen sind', async () => {
      // Arrange
      await seedStack()
      await renderToday()
      await screen.findByRole('blockquote')
      const buttons = () =>
        [en.gestureLessOften, en.gestureThought, en.gestureRest, en.gestureMoreOften, en.cardMenu].map((name) =>
          screen.getByRole('button', { name, hidden: true })
        )
      expect(buttons().every((button) => !button.hasAttribute('disabled'))).toBe(true)

      // Act / Assert: thought sheet
      fireEvent.click(screen.getByRole('button', { name: en.gestureThought }))
      expect(buttons().every((button) => button.hasAttribute('disabled'))).toBe(true)
      fireEvent.click(screen.getByRole('button', { name: en.cancel }))
      expect(buttons().every((button) => !button.hasAttribute('disabled'))).toBe(true)

      // Act / Assert: context menu
      fireEvent.click(screen.getByRole('button', { name: en.cardMenu }))
      expect(buttons().every((button) => button.hasAttribute('disabled'))).toBe(true)
    })

    it('sperrt die Leiste, solange der Gesten-Coach sichtbar ist', async () => {
      // Arrange
      localStorage.removeItem(coachKey)
      await seedStack()

      // Act
      await renderToday()
      await screen.findByRole('button', { name: en.coachGotIt })

      // Assert
      expect(screen.getByRole('button', { name: en.gestureMoreOften, hidden: true })).toBeDisabled()
    })

    it('zeigt den Hinweis zum jüngsten Gedanken auf der Karte', async () => {
      // Arrange
      await upsertQuotes([
        makeQuote({ id: 't-1', text: 'Eins', thoughts: [{ id: 'x', text: 'Ein alter Gedanke', createdAt: new Date().toISOString() }] })
      ])

      // Act
      await renderToday()

      // Assert
      expect(await screen.findByText(/Ein alter Gedanke/)).toBeInTheDocument()
    })

    it('Ruhen lassen wirkt wie Wischen nach unten', async () => {
      // Arrange
      await seedStack()
      await renderToday()
      await screen.findByRole('blockquote')
      const first = currentId()

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.gestureRest }))

      // Assert
      expect(screen.getByText('1 of 2')).toBeInTheDocument()
      await waitFor(async () => expect((await getQuote(first))?.status).toBe('rest'), SLOW)
      expect(useToastStore.getState().toast?.message).toBe(en.restedToast)
    })

    it('kennzeichnet die Aktionen-Schaltfläche als Menü mit Zustand', async () => {
      // Arrange
      await seedStack()
      await renderToday()
      await screen.findByRole('blockquote')
      const menuButton = screen.getByRole('button', { name: en.cardMenu })

      // Assert
      expect(menuButton).toHaveAttribute('aria-haspopup', 'menu')
      expect(menuButton).toHaveAttribute('aria-expanded', 'false')

      // Act
      fireEvent.click(menuButton)

      // Assert
      expect(menuButton).toHaveAttribute('aria-expanded', 'true')
    })

    it('zeigt für Gedanke und Ruhen lassen eigene Symbole statt Pfeilen', async () => {
      // Arrange / Act
      await seedStack()
      await renderToday()
      await screen.findByRole('blockquote')

      // Assert
      expect(screen.getByRole('button', { name: en.gestureThought }).querySelector('svg.lucide-pen-line')).not.toBeNull()
      expect(screen.getByRole('button', { name: en.gestureRest }).querySelector('svg.lucide-moon')).not.toBeNull()
    })

    it('Aktionen öffnet das Kontextmenü', async () => {
      // Arrange
      await seedStack()
      await renderToday()
      await screen.findByRole('blockquote')

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.cardMenu }))

      // Assert
      expect(screen.getByText(en.contextActions)).toBeInTheDocument()
    })

    it('fehlt, wenn keine Karte fällig ist', async () => {
      // Arrange / Act
      await renderToday()
      await screen.findByText(en.nothingDueToday)

      // Assert
      expect(screen.queryByRole('button', { name: en.gestureRest })).not.toBeInTheDocument()
    })
  })
  describe('Layout des Kartenbereichs', () => {
    it('gibt der Karte die ganze Höhe, solange nicht gestöbert wird', async () => {
      // Arrange
      await seedStack()

      // Act
      await renderToday()
      await screen.findByRole('blockquote')

      // Assert
      const area = screen.getByTestId('today-deck-area')
      expect(area).toHaveClass('grid-rows-[minmax(0,1fr)]')
      expect(area).not.toHaveClass('grid-rows-[auto_minmax(0,1fr)]')
    })

    it('reserviert beim Stöbern eine Zeile für den Hinweis über der Karte', async () => {
      // Arrange
      const future = new Date(Date.now() + 5 * 86_400_000).toISOString()
      await upsertQuotes([makeQuote({ id: 't-1', text: 'Eins', nextReviewAt: future, reviewIntervalDays: 5, reviewCount: 2 })])
      await renderToday()
      fireEvent.click(await screen.findByRole('button', { name: en.browseAnyway }))
      await screen.findByRole('blockquote')

      // Act
      const area = screen.getByTestId('today-deck-area')

      // Assert
      expect(area).toHaveClass('grid-rows-[auto_minmax(0,1fr)]')
    })
  })

  describe('Abschluss nach dem Ruhenlassen aller Karten', () => {
    it('zeigt Stapel beendet statt Nichts fällig, wenn jede Karte des Tages ruht', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 't-1', text: 'Eins' })])
      await renderToday()
      await screen.findByRole('blockquote')

      // Act
      swipe(0, 160)

      // Assert
      expect(await screen.findByText(en.doneForToday, undefined, SLOW)).toBeInTheDocument()
      expect(screen.queryByText(en.nothingDueToday)).not.toBeInTheDocument()
      await expectStatusSettled('t-1', 'rest')
    })
  })

  describe('Leerzustand', () => {
    it('bietet keine eigene Erfassen-Pille an; erfasst wird über das Plus unten', async () => {
      // Arrange / Act
      await renderToday()
      await screen.findByText(en.nothingDueToday)

      // Assert
      expect(screen.queryByRole('button', { name: en.text })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: en.photoNote })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: en.voiceNote })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: en.openCapture })).toBeInTheDocument()
    })
  })

  describe('Stöbern', () => {
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString()

    async function seedNotDue() {
      await upsertQuotes([
        makeQuote({ id: 't-1', text: 'Eins', nextReviewAt: future, reviewIntervalDays: 5, reviewCount: 2 }),
        makeQuote({ id: 't-2', text: 'Zwei', nextReviewAt: future, reviewIntervalDays: 5, reviewCount: 2 })
      ])
    }

    it('bietet im Leerzustand Trotzdem stöbern an und zeigt danach Karten mit Hinweis', async () => {
      // Arrange
      await seedNotDue()
      await renderToday()
      await screen.findByText(en.nothingDueToday)

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.browseAnyway }))

      // Assert
      await screen.findByRole('blockquote')
      expect(screen.getByText(en.browsingLabel)).toBeInTheDocument()
      expect(screen.getByText('1 of 2')).toBeInTheDocument()
    })

    it('bietet ohne Signale kein Stöbern an', async () => {
      // Arrange / Act
      await renderToday()
      await screen.findByText(en.nothingDueToday)

      // Assert
      expect(screen.queryByRole('button', { name: en.browseAnyway })).not.toBeInTheDocument()
    })

    async function startBrowsing() {
      await seedNotDue()
      await renderToday()
      fireEvent.click(await screen.findByRole('button', { name: en.browseAnyway }))
      await screen.findByRole('blockquote')
    }

    async function expectUntouched(id: string) {
      const stored = await getQuote(id)
      expect(stored?.status).toBe('signal')
      expect(stored?.likes ?? 0).toBe(0)
      expect(stored?.reviewIntervalDays).toBe(5)
      expect(stored?.nextReviewAt).toBe(future)
      expect(stored?.reviewCount).toBe(2)
      expect(stored?.lastReviewedAt).toBeUndefined()
      expect(stored?.activity).toBeUndefined()
    }

    it('sagt ehrlich, dass beim Stöbern nichts verschoben wird', async () => {
      // Arrange / Act
      await startBrowsing()

      // Assert
      expect(screen.getByText(en.browsingLabel)).toHaveTextContent('Just looking – nothing gets rescheduled.')
    })

    it('zeigt beim Stöbern in der Leiste nur Gedanke und Weiter', async () => {
      // Arrange / Act
      await startBrowsing()

      // Assert
      const toolbar = within(screen.getByRole('toolbar', { name: en.cardActionBar }))
      expect(toolbar.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([en.gestureThought, en.next])
      expect(screen.queryByRole('button', { name: en.gestureMoreOften })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: en.gestureLessOften })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: en.gestureRest })).not.toBeInTheDocument()
    })

    it('blättert beim Stöbern per Weiter nur weiter und ändert nichts', async () => {
      // Arrange
      await startBrowsing()
      const first = currentId()

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.next }))

      // Assert
      await waitFor(() => expect(screen.getByText('2 of 2')).toBeInTheDocument(), SLOW)
      await expectUntouched(first)
      expect(useToastStore.getState().toast).toBeNull()
    })

    it('geht beim Stöbern per Wisch nach rechts nur weiter, ohne Like und ohne Toast', async () => {
      // Arrange
      await startBrowsing()
      const first = currentId()

      // Act
      swipe(160)

      // Assert
      await waitFor(() => expect(screen.getByText('2 of 2')).toBeInTheDocument(), SLOW)
      await expectUntouched(first)
      expect(useToastStore.getState().toast).toBeNull()
    })

    it('lässt beim Stöbern einen Wisch nach unten nichts ruhen', async () => {
      // Arrange
      await startBrowsing()
      const first = currentId()

      // Act
      swipe(0, 160)
      await new Promise((resolve) => setTimeout(resolve, 800))

      // Assert
      expect(currentId()).toBe(first)
      expect(screen.getByText('1 of 2')).toBeInTheDocument()
      await expectUntouched(first)
      expect(useToastStore.getState().toast).toBeNull()
    })

    it('bietet beim Stöbern im Kartenmenü Favorit und Details, aber kein Löschen', async () => {
      // Arrange
      await startBrowsing()

      // Act
      await longPress()

      // Assert
      expect(screen.getByRole('button', { name: en.favorite })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: en.openDetails })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: en.deleteEntry })).not.toBeInTheDocument()
    })

    it('erlaubt beim Stöbern einen Gedanken, ohne die Abstände zu ändern', async () => {
      // Arrange
      await startBrowsing()
      const first = currentId()

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.gestureThought }))
      fireEvent.change(screen.getByPlaceholderText(en.thoughtPlaceholder), { target: { value: 'Beim Stöbern gedacht' } })
      fireEvent.click(screen.getByRole('button', { name: en.save }))

      // Assert
      await waitFor(async () => expect((await getQuote(first))?.thoughts?.map((thought) => thought.text)).toEqual(['Beim Stöbern gedacht']), SLOW)
      const stored = await getQuote(first)
      expect(stored?.reviewIntervalDays).toBe(5)
      expect(stored?.nextReviewAt).toBe(future)
      await waitFor(() => expect(useQuoteStore.getState().quotes.find((quote) => quote.id === first)?.thoughts).toHaveLength(1))
    })

    it('geht beim Stöbern per Wisch nach links nur weiter und ändert nichts', async () => {
      // Arrange
      await seedNotDue()
      await renderToday()
      fireEvent.click(await screen.findByRole('button', { name: en.browseAnyway }))
      await screen.findByRole('blockquote')
      const first = currentId()

      // Act
      swipe(-160)

      // Assert
      await waitFor(() => expect(screen.getByText('2 of 2')).toBeInTheDocument(), SLOW)
      const stored = await getQuote(first)
      expect(stored?.likes ?? 0).toBe(0)
      expect(stored?.reviewIntervalDays).toBe(5)
      expect(stored?.nextReviewAt).toBe(future)
      expect(useToastStore.getState().toast).toBeNull()
    })

    it('führt Fertig zurück zur Ruheansicht', async () => {
      // Arrange
      await seedNotDue()
      await renderToday()
      fireEvent.click(await screen.findByRole('button', { name: en.browseAnyway }))
      await screen.findByRole('blockquote')

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.stopBrowsing }))

      // Assert
      expect(await screen.findByText(en.nothingDueToday)).toBeInTheDocument()
      expect(screen.queryByText(en.browsingLabel)).not.toBeInTheDocument()
    })

    it('bietet nach dem Durcharbeiten des Tagesstapels Stöbern an', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 't-1', text: 'Eins' })])
      await renderToday()
      await screen.findByRole('blockquote')
      swipe(-160)
      await screen.findByText(en.doneForToday, undefined, SLOW)
      await waitFor(() => expect(useQuoteStore.getState().quotes[0]?.reviewIntervalDays).toBe(14), SLOW)

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.browseAnyway }))

      // Assert
      expect(await screen.findByRole('blockquote', undefined, SLOW)).toBeInTheDocument()
      expect(screen.getByText(en.browsingLabel)).toBeInTheDocument()
    })

    it('bietet nach einem durchgesehenen Stöberstapel erneut Stöbern an', async () => {
      // Arrange
      await seedNotDue()
      await renderToday()
      fireEvent.click(await screen.findByRole('button', { name: en.browseAnyway }))
      await screen.findByRole('blockquote')
      swipe(-160)
      await waitFor(() => expect(screen.getByText('2 of 2')).toBeInTheDocument(), SLOW)
      swipe(-160)

      // Act
      const again = await screen.findByRole('button', { name: en.browseAnyway }, SLOW)
      expect(screen.getByText(en.doneForToday)).toBeInTheDocument()
      expect(screen.queryByText(en.browsingLabel)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: en.stopBrowsing })).not.toBeInTheDocument()
      fireEvent.click(again)

      // Assert
      expect(await screen.findByRole('blockquote')).toBeInTheDocument()
      expect(screen.getByText('1 of 2')).toBeInTheDocument()
    })

    it('blendet beim Wechsel in eine neue Stöberrunde den alten Rückgängig-Hinweis aus', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 't-1', text: 'Eins' })])
      await renderToday()
      await screen.findByRole('blockquote')
      swipe(160)
      await screen.findByText(en.doneForToday, undefined, SLOW)
      await waitFor(() => expect(useToastStore.getState().toast?.message).toMatch(/^Comes back in \d+ days$/), SLOW)

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.browseAnyway }))

      // Assert
      expect(await screen.findByRole('blockquote', undefined, SLOW)).toBeInTheDocument()
      expect(useToastStore.getState().toast).toBeNull()
      expect(screen.getByText('1 of 1')).toBeInTheDocument()
    })
  })
})
