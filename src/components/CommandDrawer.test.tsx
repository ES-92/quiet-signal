import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/database'
import { translations } from '../i18n/translations'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { makeBook, makeQuote, resetFactories } from '../test/factories'
import { renderWithProviders } from '../test/render'
import { CommandDrawer } from './CommandDrawer'

const en = translations.en

beforeEach(async () => {
  resetFactories()
  await db.delete()
  await db.open()
  useQuoteStore.setState({ quotes: [] })
  useBookStore.setState({ books: [] })
})

describe('CommandDrawer', () => {
  it('rendert nichts, solange es geschlossen ist', () => {
    // Arrange / Act
    renderWithProviders(<CommandDrawer open={false} onClose={vi.fn()} onSupport={vi.fn()} />)

    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('zeigt beim Öffnen alle Navigationsziele', () => {
    // Arrange / Act
    renderWithProviders(<CommandDrawer open onClose={vi.fn()} onSupport={vi.fn()} />)

    // Assert
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: en.trash })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: en.today })).toBeInTheDocument()
  })

  it('nennt die Seite der ungeklärten Einträge Klären und den Drawer Menü', () => {
    // Arrange / Act
    renderWithProviders(<CommandDrawer open onClose={vi.fn()} onSupport={vi.fn()} />)

    // Assert
    expect(screen.getByRole('link', { name: 'Clarify' })).toHaveAttribute('href', '/inbox')
    expect(screen.queryByRole('link', { name: en.noiseInbox })).not.toBeInTheDocument()
    expect(screen.getByText('Menu')).toBeInTheDocument()
    expect(screen.queryByText('Tools')).not.toBeInTheDocument()
  })

  it('hat einen Favoriten-Eintrag, der die Bibliothek auf dem Favoriten-Tab öffnet', () => {
    // Arrange / Act
    renderWithProviders(<CommandDrawer open onClose={vi.fn()} onSupport={vi.fn()} />)

    // Assert
    expect(screen.getByRole('link', { name: en.favorites })).toHaveAttribute('href', '/library?view=favorites')
  })

  it('markiert nur einen der Einträge Favoriten und Sammlung als aktiv', () => {
    // Arrange / Act
    const { unmount } = renderWithProviders(<CommandDrawer open onClose={vi.fn()} onSupport={vi.fn()} />, { route: '/library?view=favorites' })

    // Assert
    expect(screen.getByRole('link', { name: en.favorites })).toHaveClass('bg-ink')
    expect(screen.getByRole('link', { name: en.library })).not.toHaveClass('bg-ink')
    unmount()
    renderWithProviders(<CommandDrawer open onClose={vi.fn()} onSupport={vi.fn()} />, { route: '/library' })
    expect(screen.getByRole('link', { name: en.library })).toHaveClass('bg-ink')
    expect(screen.getByRole('link', { name: en.favorites })).not.toHaveClass('bg-ink')
  })

  it('nutzt für das Suchfeld mindestens 16px auf dem Handy, damit iOS nicht hineinzoomt', () => {
    // Arrange / Act
    renderWithProviders(<CommandDrawer open onClose={vi.fn()} onSupport={vi.fn()} />)

    // Assert
    const input = screen.getByRole('textbox', { name: en.commandSearchPlaceholder })
    expect(input).toHaveClass('text-base', 'sm:text-sm')
    expect(input).not.toHaveClass('text-sm')
  })

  it('filtert die Navigationsziele nach der Suche', () => {
    // Arrange
    renderWithProviders(<CommandDrawer open onClose={vi.fn()} onSupport={vi.fn()} />)

    // Act
    fireEvent.change(screen.getByRole('textbox', { name: en.commandSearchPlaceholder }), { target: { value: 'trash' } })

    // Assert
    expect(screen.getByRole('link', { name: en.trash })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: en.today })).not.toBeInTheDocument()
  })

  it('zeigt einen Hinweis, wenn nichts gefunden wird', () => {
    // Arrange
    renderWithProviders(<CommandDrawer open onClose={vi.fn()} onSupport={vi.fn()} />)

    // Act
    fireEvent.change(screen.getByRole('textbox', { name: en.commandSearchPlaceholder }), { target: { value: 'zzzxqy' } })

    // Assert
    expect(screen.getByText(en.commandNoMatches)).toBeInTheDocument()
  })

  it('lädt beim Öffnen Zitate und Bücher aus der Datenbank und findet sie über die Suche', async () => {
    // Arrange
    await db.quotes.put(makeQuote({ text: 'Schweigen ist Gold' }))
    await db.books.put(makeBook({ title: 'Schweigen lernen' }))
    renderWithProviders(<CommandDrawer open onClose={vi.fn()} onSupport={vi.fn()} />)

    // Act
    await waitFor(() => expect(useQuoteStore.getState().quotes).toHaveLength(1))
    await waitFor(() => expect(useBookStore.getState().books).toHaveLength(1))
    fireEvent.change(screen.getByRole('textbox', { name: en.commandSearchPlaceholder }), { target: { value: 'schweigen' } })

    // Assert
    expect(screen.getByText('Schweigen ist Gold')).toBeInTheDocument()
    expect(screen.getByText('Schweigen lernen')).toBeInTheDocument()
  })

  it('findet Einträge über Gedanken und listet Stille-Einträge mit, aber kein Rauschen', async () => {
    // Arrange
    await db.quotes.bulkPut([
      makeQuote({ text: 'Ruhender Eintrag', status: 'rest', thoughts: [{ id: 't-1', text: 'Nebelmorgen', createdAt: '2026-02-01T09:00:00.000Z' }] }),
      makeQuote({ text: 'Nebel im Posteingang', status: 'inbox' })
    ])
    renderWithProviders(<CommandDrawer open onClose={vi.fn()} onSupport={vi.fn()} />)

    // Act
    await waitFor(() => expect(useQuoteStore.getState().quotes).toHaveLength(2))
    fireEvent.change(screen.getByRole('textbox', { name: en.commandSearchPlaceholder }), { target: { value: 'nebel' } })

    // Assert
    expect(screen.getByText('Ruhender Eintrag')).toBeInTheDocument()
    expect(screen.queryByText('Nebel im Posteingang')).not.toBeInTheDocument()
  })

  it('leert die Suche beim erneuten Öffnen', () => {
    // Arrange
    const { rerender } = renderWithProviders(<CommandDrawer open onClose={vi.fn()} onSupport={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox', { name: en.commandSearchPlaceholder }), { target: { value: 'trash' } })

    // Act
    act(() => {
      rerender(<CommandDrawer open={false} onClose={vi.fn()} onSupport={vi.fn()} />)
    })
    act(() => {
      rerender(<CommandDrawer open onClose={vi.fn()} onSupport={vi.fn()} />)
    })

    // Assert
    expect(screen.getByRole('textbox', { name: en.commandSearchPlaceholder })).toHaveValue('')
    expect(screen.getByRole('link', { name: en.today })).toBeInTheDocument()
  })

  it('ruft onClose bei Escape auf', () => {
    // Arrange
    const onClose = vi.fn()
    renderWithProviders(<CommandDrawer open onClose={onClose} onSupport={vi.fn()} />)

    // Act
    fireEvent.keyDown(window, { key: 'Escape' })

    // Assert
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('opens the support sheet from the support entry and closes the drawer', () => {
    // Arrange
    const onClose = vi.fn()
    const onSupport = vi.fn()
    renderWithProviders(<CommandDrawer open onClose={onClose} onSupport={onSupport} />)

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.supportProjectAction }))

    // Assert
    expect(onSupport).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
