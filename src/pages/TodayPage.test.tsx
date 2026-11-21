import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, getQuote, upsertBooks, upsertQuotes } from '../db/database'
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
  useQuoteStore.setState({ quotes: [], loading: true })
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
    fireEvent.click(screen.getByRole('button', { name: en.deleteNoise }))
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
      useQuoteStore.setState({ restQuote: async (id) => { await gate; await realRest(id) } })
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
    fireEvent.click(screen.getByRole('button', { name: en.deleteNoise }))

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

  it('schließt den Buch-Editor, sobald eine andere Karte oben liegt', async () => {
    // Arrange
    await upsertBooks([makeBook({ id: 'b-1', title: 'Das Buch' })])
    await upsertQuotes([
      makeQuote({ id: 't-1', text: 'Eins', bookId: 'b-1' }),
      makeQuote({ id: 't-2', text: 'Zwei', bookId: 'b-1' })
    ])
    await renderToday()
    await screen.findByRole('blockquote')
    await longPress()
    fireEvent.click(screen.getByRole('button', { name: en.editBookInline }))
    expect(await screen.findByLabelText(en.bookTitleLabel)).toHaveValue('Das Buch')

    // Act
    removeFromStore(currentId())

    // Assert
    await waitFor(() => expect(screen.queryByLabelText(en.bookTitleLabel)).not.toBeInTheDocument())
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

  it('stellt eine über das Kontextmenü gelöschte Karte per Rückgängig wieder her', async () => {
    // Arrange
    await seedStack()
    await renderToday()
    await screen.findByRole('blockquote')
    const first = currentText()
    const firstId = currentId()
    await longPress()
    fireEvent.click(screen.getByRole('button', { name: en.deleteNoise }))
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

  it('speichert Titel und Autor des Buchs über den Buch-Editor', async () => {
    // Arrange
    await upsertBooks([makeBook({ id: 'b-1', title: 'Das Buch' })])
    await upsertQuotes([makeQuote({ id: 't-1', text: 'Eins', bookId: 'b-1' })])
    await renderToday()
    await screen.findByRole('blockquote')
    await longPress()
    fireEvent.click(screen.getByRole('button', { name: en.editBookInline }))
    const title = await screen.findByLabelText(en.bookTitleLabel)

    // Act
    fireEvent.change(title, { target: { value: '  Neuer Titel ' } })
    fireEvent.change(screen.getByLabelText(en.bookAuthorLabel), { target: { value: ' Autorin ' } })
    fireEvent.click(screen.getByRole('button', { name: en.saveChanges }))

    // Assert
    await waitFor(() => expect(screen.queryByLabelText(en.bookTitleLabel)).not.toBeInTheDocument(), SLOW)
    await waitFor(() => {
      const book = useBookStore.getState().books[0]
      expect(book?.title).toBe('Neuer Titel')
      expect(book?.author).toBe('Autorin')
    }, SLOW)
  })

  it('schließt den Buch-Editor ohne Speichern über Abbrechen', async () => {
    // Arrange
    await upsertBooks([makeBook({ id: 'b-1', title: 'Das Buch' })])
    await upsertQuotes([makeQuote({ id: 't-1', text: 'Eins', bookId: 'b-1' })])
    await renderToday()
    await screen.findByRole('blockquote')
    await longPress()
    fireEvent.click(screen.getByRole('button', { name: en.editBookInline }))
    fireEvent.change(await screen.findByLabelText(en.bookTitleLabel), { target: { value: 'Anders' } })

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.cancel }))

    // Assert
    expect(screen.queryByLabelText(en.bookTitleLabel)).not.toBeInTheDocument()
    expect(useBookStore.getState().books[0]?.title).toBe('Das Buch')
  })

  it('zeigt den Reflexions-Hinweis ab drei Einträgen dieser Woche und öffnet die Reflexionen', async () => {
    // Arrange
    const now = new Date().toISOString()
    await upsertQuotes([
      makeQuote({ id: 't-1', text: 'Eins', createdAt: now, updatedAt: now }),
      makeQuote({ id: 't-2', text: 'Zwei', createdAt: now, updatedAt: now }),
      makeQuote({ id: 't-3', text: 'Drei', createdAt: now, updatedAt: now })
    ])
    await renderToday()
    await screen.findByRole('blockquote')

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.openReflections }))

    // Assert
    expect(screen.getByTestId('location')).toHaveTextContent('/reflections')
  })

  it('zeigt ohne genug Einträge den Hinweis zum Erfassen statt des Reflexions-Hinweises', async () => {
    // Arrange / Act
    await renderToday()

    // Assert
    expect(screen.queryByRole('button', { name: en.openReflections })).not.toBeInTheDocument()
    expect(screen.getByText(en.swipeDownCapture)).toBeInTheDocument()
  })

  it('zeigt im Kontextmenü Favorit, Details, Buch bearbeiten und Löschen, aber weder Später noch Nicht mögen', async () => {
    // Arrange
    await upsertBooks([makeBook({ id: 'b-1', title: 'Das Buch' })])
    await upsertQuotes([makeQuote({ id: 't-1', text: 'Eins', bookId: 'b-1' })])
    await renderToday()
    await screen.findByRole('blockquote')

    // Act
    await longPress()

    // Assert
    for (const name of [en.favorite, en.openDetails, en.editBookInline, en.deleteNoise]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: en.later })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: en.dislike })).not.toBeInTheDocument()
  })

  describe('Aktionsleiste', () => {
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
})
