import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, listQuotes } from '../db/database'
import { translations } from '../i18n/translations'
import { useQuoteStore } from '../store/useQuoteStore'
import { renderWithProviders } from '../test/render'
import { ShareTargetPage } from './ShareTargetPage'

const en = translations.en
const originalAddQuote = useQuoteStore.getState().addQuote

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterEach(() => {
  useQuoteStore.setState({ addQuote: originalAddQuote })
  vi.restoreAllMocks()
})

describe('ShareTargetPage', () => {
  it('speichert geteilte Inhalte im Rauschen', async () => {
    // Act
    renderWithProviders(<ShareTargetPage />, { route: '/share-target?text=Hallo' })

    // Assert
    expect(await screen.findByText(en.shareImported)).toBeInTheDocument()
    expect((await listQuotes()).map((quote) => quote.text)).toEqual(['Hallo'])
  })

  it('zeigt bei einem Fehler einen Hinweis mit Wiederholen statt endlos zu laden', async () => {
    // Arrange
    const addQuote = vi.fn().mockRejectedValueOnce(new Error('kaputt')).mockImplementation(originalAddQuote)
    useQuoteStore.setState({ addQuote })

    // Act
    renderWithProviders(<ShareTargetPage />, { route: '/share-target?text=Hallo' })

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(en.shareFailed)
    expect(screen.getByRole('link', { name: en.today })).toHaveAttribute('href', '/today')

    // Act: erneut versuchen
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.shareRetry }))
    })

    // Assert
    expect(await screen.findByText(en.shareImported)).toBeInTheDocument()
    expect(addQuote).toHaveBeenCalledTimes(2)
    expect(await listQuotes()).toHaveLength(1)
  })

  it('räumt den Weiterleitungs-Timer beim Verlassen der Seite auf', async () => {
    // Arrange
    const { unmount } = renderWithProviders(<ShareTargetPage />, { route: '/share-target?text=Hallo' })
    expect(await screen.findByText(en.shareImported)).toBeInTheDocument()
    const clearTimeout = vi.spyOn(window, 'clearTimeout')

    // Act
    unmount()

    // Assert
    expect(clearTimeout).toHaveBeenCalled()
  })
})
