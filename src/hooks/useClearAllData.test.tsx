import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, listBooks, listQuotes, upsertBooks, upsertQuotes } from '../db/database'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { makeBook, makeQuote, resetFactories } from '../test/factories'
import { useClearAllData } from './useClearAllData'

beforeEach(async () => {
  resetFactories()
  await db.delete()
  await db.open()
  useQuoteStore.setState({ quotes: [] })
  useBookStore.setState({ books: [] })
})

describe('useClearAllData', () => {
  it('öffnet und schließt die Bestätigung, ohne Daten zu löschen', async () => {
    // Arrange
    await upsertQuotes([makeQuote()])
    const { result } = renderHook(() => useClearAllData())

    // Act
    act(() => result.current.request())
    const openedState = result.current.confirmOpen
    act(() => result.current.cancel())

    // Assert
    expect(openedState).toBe(true)
    expect(result.current.confirmOpen).toBe(false)
    expect(await listQuotes()).toHaveLength(1)
  })

  it('löscht nach der Bestätigung Einträge und Bücher und schließt die Bestätigung', async () => {
    // Arrange
    await upsertQuotes([makeQuote()])
    await upsertBooks([makeBook()])
    const { result } = renderHook(() => useClearAllData())
    act(() => result.current.request())

    // Act
    await act(async () => result.current.confirm())

    // Assert
    expect(await listQuotes()).toHaveLength(0)
    expect(await listBooks()).toHaveLength(0)
    expect(result.current.confirmOpen).toBe(false)
  })
})
