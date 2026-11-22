import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, listQuotes } from '../db/database'
import { translations } from '../i18n/translations'
import { useQuoteStore } from '../store/useQuoteStore'
import { useToastStore } from '../store/useToastStore'
import { renderWithProviders } from '../test/render'
import { ZeroCaptureSheet } from './ZeroCaptureSheet'

const en = translations.en

beforeEach(async () => {
  await db.delete()
  await db.open()
  useToastStore.setState({ toast: null })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ZeroCaptureSheet', () => {
  it('rendert nichts, solange es geschlossen ist', () => {
    // Arrange / Act
    renderWithProviders(<ZeroCaptureSheet open={false} onClose={vi.fn()} initialMode="text" />)

    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('öffnet im übergebenen Modus', () => {
    // Arrange / Act
    renderWithProviders(<ZeroCaptureSheet open onClose={vi.fn()} initialMode="photo" />)

    // Assert
    expect(screen.getByRole('button', { name: en.photoNote })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: en.text })).toHaveAttribute('aria-pressed', 'false')
  })

  it('wechselt den Modus per Klick', () => {
    // Arrange
    renderWithProviders(<ZeroCaptureSheet open onClose={vi.fn()} initialMode="text" />)

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.voiceNote }))

    // Assert
    expect(screen.getByRole('button', { name: en.voiceNote })).toHaveAttribute('aria-pressed', 'true')
  })

  it('ruft onClose bei Escape auf', () => {
    // Arrange
    const onClose = vi.fn()
    renderWithProviders(<ZeroCaptureSheet open onClose={onClose} initialMode="text" />)

    // Act
    fireEvent.keyDown(window, { key: 'Escape' })

    // Assert
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('verwirft eingetippten Text und Modus, wenn das Sheet geschlossen und neu geöffnet wird', () => {
    // Arrange
    const onClose = vi.fn()
    const { rerender } = renderWithProviders(<ZeroCaptureSheet open onClose={onClose} initialMode="text" />)
    fireEvent.change(screen.getByPlaceholderText(en.noisePlaceholder), { target: { value: 'Entwurf' } })
    fireEvent.click(screen.getByRole('button', { name: en.voiceNote }))

    // Act
    act(() => {
      rerender(<ZeroCaptureSheet open={false} onClose={onClose} initialMode="text" />)
    })
    act(() => {
      rerender(<ZeroCaptureSheet open onClose={onClose} initialMode="text" />)
    })

    // Assert
    expect(screen.getByRole('button', { name: en.text })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByPlaceholderText(en.noisePlaceholder)).toHaveValue('')
  })

  it('speichert den Text als Inbox-Eintrag und schließt das Sheet', async () => {
    // Arrange
    const onClose = vi.fn()
    renderWithProviders(<ZeroCaptureSheet open onClose={onClose} initialMode="text" />)
    fireEvent.change(screen.getByPlaceholderText(en.noisePlaceholder), { target: { value: '  Ein Gedanke  ' } })

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.captureNoise }))

    // Assert
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    const quotes = await listQuotes()
    expect(quotes).toHaveLength(1)
    expect(quotes[0]).toMatchObject({ text: 'Ein Gedanke', status: 'inbox' })
  })
})

describe('ZeroCaptureSheet beim Speichern', () => {
  it('speichert bei doppeltem Tippen nur einen Eintrag', async () => {
    // Arrange
    const onClose = vi.fn()
    renderWithProviders(<ZeroCaptureSheet open onClose={onClose} initialMode="text" />)
    fireEvent.change(screen.getByPlaceholderText(en.noisePlaceholder), { target: { value: 'Einmal' } })
    const save = screen.getByRole('button', { name: en.captureNoise })

    // Act
    await act(async () => {
      fireEvent.click(save)
      fireEvent.click(save)
    })

    // Assert
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(await listQuotes()).toHaveLength(1)
  })

  it('behält den Text und zeigt einen Hinweis, wenn das Speichern fehlschlägt', async () => {
    // Arrange
    const onClose = vi.fn()
    const addQuote = vi.fn().mockRejectedValue(new Error('QuotaExceededError'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const original = useQuoteStore.getState().addQuote
    useQuoteStore.setState({ addQuote })
    renderWithProviders(<ZeroCaptureSheet open onClose={onClose} initialMode="text" />)
    fireEvent.change(screen.getByPlaceholderText(en.noisePlaceholder), { target: { value: 'Nicht verlieren' } })

    // Act
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.captureNoise }))
    })

    // Assert
    expect(addQuote).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(useToastStore.getState().toast?.message).toBe(en.saveFailed)
    expect(screen.getByPlaceholderText(en.noisePlaceholder)).toHaveValue('Nicht verlieren')
    expect(screen.getByRole('button', { name: en.captureNoise })).toBeEnabled()
    useQuoteStore.setState({ addQuote: original })
  })
})
