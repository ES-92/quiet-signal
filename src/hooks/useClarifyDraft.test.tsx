import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeBook, makeQuote } from '../test/factories'
import { useClarifyDraft } from './useClarifyDraft'

describe('useClarifyDraft', () => {
  it('startet mit leerem Entwurf, solange kein Eintrag oben liegt', () => {
    // Arrange / Act
    const { result } = renderHook(() => useClarifyDraft(undefined, []))

    // Assert
    expect(result.current.draft).toMatchObject({ text: '', entryType: 'note', strength: 'normal' })
    expect(result.current.detailsOpen).toBe(false)
  })

  it('übernimmt die Werte des obersten Eintrags in den Entwurf', () => {
    // Arrange
    const quote = makeQuote({
      text: 'Text',
      tags: ['a', 'b'],
      note: 'N',
      entryType: 'memory',
      signalStrength: 'strong',
      people: ['Anna', 'Bob'],
      locationName: 'Hannover'
    })

    // Act
    const { result } = renderHook(() => useClarifyDraft(quote, []))

    // Assert
    expect(result.current.draft).toMatchObject({
      text: 'Text',
      tags: 'a, b',
      note: 'N',
      entryType: 'memory',
      strength: 'strong',
      people: 'Anna, Bob',
      locationName: 'Hannover'
    })
  })

  it('behält Änderungen, solange derselbe Eintrag oben liegt', () => {
    // Arrange
    const quote = makeQuote({ id: 'x', text: 'Eins' })
    const { result, rerender } = renderHook(({ q }) => useClarifyDraft(q, []), { initialProps: { q: quote } })
    act(() => result.current.updateDraft({ note: 'Entwurf' }))

    // Act
    rerender({ q: { ...quote, text: 'Eins (neu geladen)' } })

    // Assert
    expect(result.current.draft.note).toBe('Entwurf')
    expect(result.current.draft.text).toBe('Eins')
  })

  it('setzt Entwurf zurück und schließt die Details, wenn ein anderer Eintrag oben liegt', () => {
    // Arrange
    const { result, rerender } = renderHook(({ q }) => useClarifyDraft(q, []), {
      initialProps: { q: makeQuote({ id: 'a', text: 'A' }) }
    })
    act(() => {
      result.current.setDetailsOpen(true)
      result.current.updateDraft({ text: 'Ungespeichert' })
    })

    // Act
    rerender({ q: makeQuote({ id: 'b', text: 'B' }) })

    // Assert
    expect(result.current.draft.text).toBe('B')
    expect(result.current.detailsOpen).toBe(false)
  })

  it('übernimmt Titel und Autor aus dem gewählten Buch und lässt den Autor ohne Buchautor stehen', () => {
    // Arrange
    const books = [
      makeBook({ id: 'b1', title: 'Titel', author: 'Autorin' }),
      makeBook({ id: 'b2', title: 'Ohne Autor' })
    ]
    const quote = makeQuote({ author: 'Alt' })
    const { result } = renderHook(() => useClarifyDraft(quote, books))

    // Act
    act(() => result.current.changeBook('b1'))
    const afterFirst = result.current.draft
    act(() => result.current.changeBook('b2'))

    // Assert
    expect(afterFirst).toMatchObject({ bookId: 'b1', work: 'Titel', author: 'Autorin' })
    expect(result.current.draft).toMatchObject({ bookId: 'b2', work: 'Ohne Autor', author: 'Autorin' })
  })

  it('setzt nur die Buch-ID, wenn das Buch unbekannt ist', () => {
    // Arrange
    const quote = makeQuote({ work: 'Werk' })
    const { result } = renderHook(() => useClarifyDraft(quote, []))

    // Act
    act(() => result.current.changeBook('unbekannt'))

    // Assert
    expect(result.current.draft).toMatchObject({ bookId: 'unbekannt', work: 'Werk' })
  })

  it('baut den Patch bereinigt: getrimmt, Tags klein, leere Felder undefined', () => {
    // Arrange
    const quote = makeQuote({ nextReviewAt: '2026-02-01T09:00:00.000Z' })
    const { result } = renderHook(() => useClarifyDraft(quote, []))
    act(() =>
      result.current.updateDraft({
        text: '  Text  ',
        tags: 'Foo, , BAR',
        note: '  ',
        author: ' Autor ',
        people: 'Anna,Bob',
        occurredAt: '2026-03-04T10:30'
      })
    )

    // Act
    const patch = result.current.buildPatch('inbox')

    // Assert
    expect(patch).toMatchObject({
      text: 'Text',
      tags: ['foo', 'bar'],
      author: 'Autor',
      people: ['Anna', 'Bob'],
      status: 'inbox',
      signalStrength: 'normal',
      nextReviewAt: '2026-02-01T09:00:00.000Z'
    })
    expect(patch.note).toBeUndefined()
    expect(patch.work).toBeUndefined()
    expect(patch.occurredAt).toBe(new Date('2026-03-04T10:30').toISOString())
  })

  it('löscht beim Signal den Wiedervorlagetermin und nimmt eine übergebene Stärke', () => {
    // Arrange
    const quote = makeQuote({ nextReviewAt: '2026-02-01T09:00:00.000Z' })
    const { result } = renderHook(() => useClarifyDraft(quote, []))

    // Act
    const patch = result.current.buildPatch('signal', 'quiet')

    // Assert
    expect(patch).toMatchObject({ status: 'signal', signalStrength: 'quiet' })
    expect(patch.nextReviewAt).toBeUndefined()
  })
})
