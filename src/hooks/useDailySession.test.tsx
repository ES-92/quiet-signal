import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, upsertBooks, upsertQuotes } from '../db/database'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { useToastStore } from '../store/useToastStore'
import { makeBook, makeQuote, resetFactories } from '../test/factories'
import { nextSessionIds, useDailySession } from './useDailySession'

beforeEach(async () => {
  resetFactories()
  await db.delete()
  await db.open()
  useQuoteStore.setState({ quotes: [], loading: true })
  useBookStore.setState({ books: [], loading: true })
})

async function renderSession() {
  const hook = renderHook(() => useDailySession())
  await waitFor(() => {
    expect(useQuoteStore.getState().loading).toBe(false)
    expect(useBookStore.getState().loading).toBe(false)
  })
  return hook
}

const ids = (quotes: { id: string }[]) => quotes.map((quote) => quote.id)

describe('nextSessionIds', () => {
  const a = makeQuote({ id: 'a' })
  const b = makeQuote({ id: 'b' })
  const c = makeQuote({ id: 'c' })

  it('übernimmt die Auswahl, solange die Sitzung noch leer ist', () => {
    // Arrange / Act
    const next = nextSessionIds([], [a, b, c], [a, b])

    // Assert
    expect(next).toEqual(['a', 'b'])
  })

  it('behält dieselbe Referenz, wenn sich die Sitzung nicht ändert', () => {
    // Arrange
    const current = ['a', 'b']

    // Act
    const next = nextSessionIds(current, [a, b, c], [c])

    // Assert
    expect(next).toBe(current)
  })

  it('entfernt Karten, die nicht mehr im Speicher sind, und behält die Reihenfolge', () => {
    // Arrange / Act
    const next = nextSessionIds(['a', 'b', 'c'], [a, c], [c])

    // Assert
    expect(next).toEqual(['a', 'c'])
  })

  it('übernimmt die neue Auswahl, wenn keine Karte der Sitzung mehr existiert', () => {
    // Arrange / Act
    const next = nextSessionIds(['a'], [c], [c])

    // Assert
    expect(next).toEqual(['c'])
  })

  it('entfernt bei leerer Auswahl nur nicht mehr vorhandene Karten', () => {
    // Arrange / Act
    const next = nextSessionIds(['a', 'b'], [a], [])

    // Assert
    expect(next).toEqual(['a'])
  })
})

describe('useDailySession', () => {
  it('lädt die Bibliothek und liefert die erste, zweite und dritte Karte samt Buch', async () => {
    // Arrange
    await upsertBooks([makeBook({ id: 'b-1' })])
    await upsertQuotes([
      makeQuote({ id: 't-1', bookId: 'b-1' }),
      makeQuote({ id: 't-2', bookId: 'b-1' }),
      makeQuote({ id: 't-3', bookId: 'b-1' }),
      makeQuote({ id: 't-4', bookId: 'b-1' })
    ])

    // Act
    const { result } = await renderSession()

    // Assert
    const { currentQuote, nextQuote, thirdQuote, dailyQuotes } = result.current
    expect(new Set([currentQuote?.id, nextQuote?.id, thirdQuote?.id]).size).toBe(3)
    expect(ids(dailyQuotes)).toContain(currentQuote?.id)
    expect(result.current.currentIndex).toBe(0)
    expect(result.current.currentBook?.id).toBe('b-1')
    expect(result.current.stackCompleted).toBe(false)
  })

  it('rückt per advanceIndex vor und begrenzt den Index auf die Stapelgröße', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 't-1' }), makeQuote({ id: 't-2' })])
    const { result } = await renderSession()

    // Act
    act(() => result.current.advanceIndex())
    act(() => result.current.advanceIndex())
    act(() => result.current.advanceIndex())

    // Assert
    expect(result.current.currentIndex).toBe(2)
    expect(result.current.currentQuote).toBeUndefined()
    expect(result.current.stackCompleted).toBe(true)
  })

  it('blendet per hideQuote sofort aus, ohne den Index zu ändern, und holt per showQuote zurück', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 't-1' }), makeQuote({ id: 't-2' }), makeQuote({ id: 't-3' })])
    const { result } = await renderSession()
    const first = result.current.currentQuote?.id as string
    const order = ids(result.current.dailyQuotes)

    // Act
    act(() => result.current.hideQuote(first))
    const hidden = ids(result.current.dailyQuotes)
    act(() => result.current.showQuote(first))

    // Assert
    expect(hidden).toEqual(order.filter((id) => id !== first))
    expect(result.current.currentIndex).toBe(0)
    expect(ids(result.current.dailyQuotes)).toEqual(order)
  })

  it('setzt eine verworfene Karte nach dem Neuladen per showQuote an ihrer ursprünglichen Position wieder ein', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 't-1' }), makeQuote({ id: 't-2' }), makeQuote({ id: 't-3' })])
    const { result } = await renderSession()
    act(() => result.current.advanceIndex())
    const order = ids(result.current.dailyQuotes)
    const middle = result.current.currentQuote?.id as string
    act(() => result.current.hideQuote(middle))
    await act(async () => {
      await useQuoteStore.getState().discardQuote(middle)
    })
    await waitFor(() => expect(useQuoteStore.getState().quotes).toHaveLength(2))

    // Act
    await act(async () => {
      result.current.showQuote(middle)
      await useQuoteStore.getState().restoreQuote(middle)
    })

    // Assert
    await waitFor(() => expect(ids(result.current.dailyQuotes)).toEqual(order))
    expect(result.current.currentIndex).toBe(1)
    expect(result.current.currentQuote?.id).toBe(middle)
  })

  it('zählt Reflexionseinträge der Woche und Eingangseinträge', async () => {
    // Arrange
    const now = new Date().toISOString()
    await upsertQuotes([
      makeQuote({ id: 't-1', createdAt: now, updatedAt: now }),
      makeQuote({ id: 't-2', createdAt: now, updatedAt: now }),
      makeQuote({ id: 't-3', createdAt: now, updatedAt: now, status: 'inbox' })
    ])

    // Act
    const { result } = await renderSession()

    // Assert
    expect(result.current.reflectionCount).toBe(3)
    expect(result.current.showReflectionNudge).toBe(true)
    expect(result.current.inboxCount).toBe(1)
  })
  it('stöbert über alle Signale, auch wenn nichts fällig ist, und kehrt mit Fertig zum Tagesstapel zurück', async () => {
    // Arrange
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString()
    await upsertQuotes([makeQuote({ id: 't-1', nextReviewAt: future }), makeQuote({ id: 't-2', nextReviewAt: future })])
    const { result } = await renderSession()
    expect(result.current.dailyQuotes).toHaveLength(0)

    // Act
    act(() => result.current.startBrowsing())
    const browseOrder = ids(result.current.dailyQuotes)
    act(() => result.current.advanceIndex())
    act(() => result.current.stopBrowsing())

    // Assert
    expect(browseOrder.sort()).toEqual(['t-1', 't-2'])
    expect(result.current.browsing).toBe(false)
    expect(result.current.dailyQuotes).toHaveLength(0)
    expect(result.current.currentIndex).toBe(0)
  })

  it('verlässt den Stöbermodus, wenn der Stöberstapel durch ist, und zeigt den Abschluss mit neuer Runde', async () => {
    // Arrange
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString()
    await upsertQuotes([makeQuote({ id: 't-1', nextReviewAt: future }), makeQuote({ id: 't-2', nextReviewAt: future })])
    const { result } = await renderSession()
    act(() => result.current.startBrowsing())
    act(() => result.current.advanceIndex())
    expect(result.current.browsing).toBe(true)

    // Act
    act(() => result.current.advanceIndex())

    // Assert
    expect(result.current.browsing).toBe(false)
    expect(result.current.currentQuote).toBeUndefined()
    expect(result.current.stackCompleted).toBe(true)
    expect(result.current.hasSignals).toBe(true)
    act(() => result.current.startBrowsing())
    expect(result.current.browsing).toBe(true)
    expect(result.current.dailyQuotes).toHaveLength(2)
    expect(result.current.currentIndex).toBe(0)
  })

  it('geht mit Fertig weiter in die Ruheansicht ohne Abschluss', async () => {
    // Arrange
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString()
    await upsertQuotes([makeQuote({ id: 't-1', nextReviewAt: future })])
    const { result } = await renderSession()
    act(() => result.current.startBrowsing())

    // Act
    act(() => result.current.stopBrowsing())

    // Assert
    expect(result.current.browsing).toBe(false)
    expect(result.current.stackCompleted).toBe(false)
  })

  it('springt mit rewindTo zur Karte mit dieser id und ignoriert unbekannte ids', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 't-1' }), makeQuote({ id: 't-2' }), makeQuote({ id: 't-3' })])
    const { result } = await renderSession()
    await waitFor(() => expect(result.current.dailyQuotes).toHaveLength(3))
    const order = ids(result.current.dailyQuotes)
    act(() => result.current.advanceIndex())
    act(() => result.current.advanceIndex())
    act(() => result.current.advanceIndex())
    expect(result.current.currentQuote).toBeUndefined()

    // Act
    act(() => result.current.rewindTo(order[0]))
    const first = result.current.currentQuote?.id
    act(() => result.current.rewindTo('gibt-es-nicht'))

    // Assert
    expect(first).toBe(order[0])
    expect(result.current.currentIndex).toBe(0)
  })

  it('bleibt im Stöbermodus, wenn die letzte Karte ruht, und holt sie per showQuote zurück', async () => {
    // Arrange
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString()
    await upsertQuotes([makeQuote({ id: 't-1', nextReviewAt: future })])
    const { result } = await renderSession()
    act(() => result.current.startBrowsing())
    expect(result.current.browsing).toBe(true)

    // Act
    act(() => result.current.hideQuote('t-1'))
    const finished = { browsing: result.current.browsing, completed: result.current.stackCompleted }
    act(() => result.current.showQuote('t-1'))

    // Assert
    expect(finished).toEqual({ browsing: false, completed: true })
    expect(result.current.browsing).toBe(true)
    expect(result.current.currentQuote?.id).toBe('t-1')
    expect(result.current.stackCompleted).toBe(false)
  })

  it('beendet mit Fertig auch einen aufgebrauchten Stöberstapel und startet danach eine neue Runde', async () => {
    // Arrange
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString()
    await upsertQuotes([makeQuote({ id: 't-1', nextReviewAt: future })])
    const { result } = await renderSession()
    act(() => result.current.startBrowsing())
    act(() => result.current.advanceIndex())

    // Act
    act(() => result.current.stopBrowsing())

    // Assert
    expect(result.current.browsing).toBe(false)
    expect(result.current.stackCompleted).toBe(false)
    act(() => result.current.startBrowsing())
    expect(result.current.currentQuote?.id).toBe('t-1')
  })

  it('blendet einen Rückgängig-Hinweis aus, wenn der Stöbermodus beginnt oder endet', async () => {
    // Arrange
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString()
    await upsertQuotes([makeQuote({ id: 't-1', nextReviewAt: future })])
    const { result } = await renderSession()

    // Act / Assert
    useToastStore.getState().showToast({ message: 'Rückgängig?', actionLabel: 'Undo', onAction: () => {} })
    act(() => result.current.startBrowsing())
    expect(useToastStore.getState().toast).toBeNull()

    useToastStore.getState().showToast({ message: 'Rückgängig?', actionLabel: 'Undo', onAction: () => {} })
    act(() => result.current.stopBrowsing())
    expect(useToastStore.getState().toast).toBeNull()

    useToastStore.getState().showToast({ message: 'Nur Info' })
    act(() => result.current.startBrowsing())
    expect(useToastStore.getState().toast?.message).toBe('Nur Info')
  })

  it('hält den Stöberstapel stabil, während sich die Bibliothek neu lädt', async () => {
    // Arrange
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString()
    await upsertQuotes([makeQuote({ id: 't-1', nextReviewAt: future }), makeQuote({ id: 't-2', nextReviewAt: future })])
    const { result } = await renderSession()
    act(() => result.current.startBrowsing())
    const order = ids(result.current.dailyQuotes)

    // Act
    await act(async () => {
      await useQuoteStore.getState().loadQuotes()
    })

    // Assert
    expect(ids(result.current.dailyQuotes)).toEqual(order)
    expect(result.current.browsing).toBe(true)
  })
})
