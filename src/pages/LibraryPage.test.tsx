import { Link } from 'react-router-dom'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, getQuote, upsertQuotes } from '../db/database'
import { translations } from '../i18n/translations'
import { useQuoteStore } from '../store/useQuoteStore'
import { useToastStore } from '../store/useToastStore'
import { makeQuote, resetFactories } from '../test/factories'
import { renderWithProviders } from '../test/render'
import { LibraryPage } from './LibraryPage'

const en = translations.en
const SLOW = { timeout: 3000 }

async function renderLibrary() {
  const result = renderWithProviders(<LibraryPage />)
  await waitFor(() => expect(useQuoteStore.getState().loading).toBe(false))
  return result
}

beforeEach(async () => {
  resetFactories()
  await db.delete()
  await db.open()
  useQuoteStore.setState({ quotes: [], loading: true })
  useQuoteStore.getState().resetFilters()
  await upsertQuotes([
    makeQuote({ id: 'l-1', text: 'Signaltext' }),
    makeQuote({ id: 'l-2', text: 'Stilletext', status: 'rest', tags: ['ruhe'] }),
    makeQuote({ id: 'l-3', text: 'Rauschtext', status: 'inbox' })
  ])
})

describe('LibraryPage', () => {
  it('shows the loading state instead of the empty state while the library is still loading', () => {
    // Arrange
    const loadQuotes = useQuoteStore.getState().loadQuotes
    useQuoteStore.setState({ quotes: [], loading: true, loadQuotes: vi.fn().mockResolvedValue(undefined) })

    // Act
    renderWithProviders(<LibraryPage />)

    // Assert
    expect(screen.getByText(en.loadingLibrary)).toBeInTheDocument()
    expect(screen.queryByText(en.emptyCollectionTitle)).not.toBeInTheDocument()
    useQuoteStore.setState({ loadQuotes })
  })

  it('shows only signals by default', async () => {
    // Arrange / Act
    await renderLibrary()

    // Assert
    expect(await screen.findByText('"Signaltext"')).toBeInTheDocument()
    expect(screen.queryByText('"Stilletext"')).not.toBeInTheDocument()
    expect(screen.queryByText('"Rauschtext"')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: en.libraryViewSignal })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows no like counter on library cards, even for liked entries', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'l-9', text: 'Geliebt', likes: 5 })])

    // Act
    await renderLibrary()
    const card = (await screen.findByText('"Geliebt"')).closest('article') as HTMLElement

    // Assert
    expect(card.textContent).not.toContain('5')
    expect(card.querySelector('button[aria-label="Remove like"]')).toBeNull()
  })

  it('shows only resting entries with badge and wake button in the rest view', async () => {
    // Arrange
    await renderLibrary()

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.libraryViewRest }))

    // Assert
    expect(await screen.findByText('"Stilletext"')).toBeInTheDocument()
    expect(screen.queryByText('"Signaltext"')).not.toBeInTheDocument()
    expect(screen.getByText(en.entryStatus_rest, { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: en.wake })).toBeInTheDocument()
  })

  it('shows signals and rest together in the all view, never noise', async () => {
    // Arrange
    await renderLibrary()

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.libraryViewAll }))

    // Assert
    expect(await screen.findByText('"Stilletext"')).toBeInTheDocument()
    expect(screen.getByText('"Signaltext"')).toBeInTheDocument()
    expect(screen.queryByText('"Rauschtext"')).not.toBeInTheDocument()
  })

  it('wakes a resting entry from the library', async () => {
    // Arrange
    await renderLibrary()
    fireEvent.click(screen.getByRole('button', { name: en.libraryViewRest }))

    // Act
    fireEvent.click(await screen.findByRole('button', { name: en.wake }))

    // Assert
    await waitFor(async () => expect((await getQuote('l-2'))?.status).toBe('signal'), SLOW)
  })

  it('shows an error toast when waking an entry fails', async () => {
    // Arrange
    await renderLibrary()
    const { wakeQuote } = useQuoteStore.getState()
    act(() => {
      useQuoteStore.setState({ wakeQuote: () => Promise.reject(new Error('boom')) })
    })
    fireEvent.click(screen.getByRole('button', { name: en.libraryViewRest }))

    // Act
    fireEvent.click(await screen.findByRole('button', { name: en.wake }))

    // Assert
    try {
      await waitFor(() => expect(useToastStore.getState().toast?.message).toBe(en.saveFailed), SLOW)
    } finally {
      useQuoteStore.setState({ wakeQuote })
      useToastStore.setState({ toast: null })
    }
  })

  it('applies the other filters within the chosen view', async () => {
    // Arrange
    await renderLibrary()
    fireEvent.click(screen.getByRole('button', { name: en.libraryViewAll }))
    await screen.findByText('"Stilletext"')

    // Act
    useQuoteStore.getState().setFilters({ tag: 'ruhe' })

    // Assert
    await waitFor(() => expect(screen.queryByText('"Signaltext"')).not.toBeInTheDocument())
    expect(screen.getByText('"Stilletext"')).toBeInTheDocument()
  })

  it('zeigt bei leerer Sammlung die Leer-Meldung statt "Keine Treffer" und keinen 0-von-0-Zähler', async () => {
    // Arrange
    await db.quotes.clear()

    // Act
    await renderLibrary()

    // Assert
    expect(await screen.findByText(en.emptyCollectionTitle)).toBeInTheDocument()
    expect(screen.queryByText(en.noMatches)).not.toBeInTheDocument()
    expect(screen.queryByText(/0 of 0/)).not.toBeInTheDocument()
  })

  it('zeigt in der leeren Stille-Ansicht die Stille-Meldung', async () => {
    // Arrange
    await db.quotes.update('l-2', { status: 'signal' })
    await renderLibrary()

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.libraryViewRest }))

    // Assert
    expect(await screen.findByText(en.emptyRestTitle)).toBeInTheDocument()
    expect(screen.queryByText(en.noMatches)).not.toBeInTheDocument()
  })

  it('behält "Keine Treffer", wenn Suche oder Filter nichts finden', async () => {
    // Arrange
    await renderLibrary()
    await screen.findByText('"Signaltext"')

    // Act
    fireEvent.change(screen.getAllByPlaceholderText(en.searchPlaceholder)[0], { target: { value: 'gibtesnicht' } })

    // Assert
    expect(await screen.findByText(en.noMatches)).toBeInTheDocument()
    expect(screen.queryByText(en.emptyCollectionTitle)).not.toBeInTheDocument()
  })

  it('lists favourite signals and rest entries, but never noise, under the Favoriten tab', async () => {
    // Arrange
    await upsertQuotes([
      makeQuote({ id: 'f-1', text: 'Fav Signal', favorite: true }),
      makeQuote({ id: 'f-2', text: 'Fav Stille', favorite: true, status: 'rest' }),
      makeQuote({ id: 'f-3', text: 'Fav Rauschen', favorite: true, status: 'inbox' })
    ])
    await renderLibrary()

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.libraryViewFavorites }))

    // Assert
    expect(await screen.findByText('"Fav Signal"')).toBeInTheDocument()
    expect(screen.getByText('"Fav Stille"')).toBeInTheDocument()
    expect(screen.queryByText('"Fav Rauschen"')).not.toBeInTheDocument()
    expect(screen.queryByText('"Signaltext"')).not.toBeInTheDocument()
  })

  it('puts Favoriten before Signale, Stille and Alle, and keeps Signale as the default', async () => {
    // Arrange / Act
    await renderLibrary()

    // Assert
    const labels = screen.getAllByRole('button', { pressed: undefined }).map((button) => button.textContent)
    expect(labels.slice(0, 4)).toEqual([en.libraryViewFavorites, en.libraryViewSignal, en.libraryViewRest, en.libraryViewAll])
    expect(screen.getByRole('button', { name: en.libraryViewSignal })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows its own empty state when there are no favourites', async () => {
    // Arrange
    await renderLibrary()

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.libraryViewFavorites }))

    // Assert
    expect(await screen.findByText(en.emptyFavoritesTitle)).toBeInTheDocument()
    expect(screen.getByText(en.emptyFavoritesBody)).toBeInTheDocument()
  })

  it('opens on the Favoriten tab for ?view=favorites', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'f-1', text: 'Fav Signal', favorite: true })])
    const result = renderWithProviders(<LibraryPage />, { route: '/library?view=favorites' })
    await waitFor(() => expect(useQuoteStore.getState().loading).toBe(false))

    // Assert
    expect(await screen.findByText('"Fav Signal"')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: en.libraryViewFavorites })).toHaveAttribute('aria-pressed', 'true')
    result.unmount()
  })

  it('toggles the heart on a card and exposes its state', async () => {
    // Arrange
    await renderLibrary()
    const card = (await screen.findByText('"Signaltext"')).closest('article') as HTMLElement
    const heart = card.querySelector('button[aria-label="' + en.favorite + '"]') as HTMLElement
    expect(heart).toHaveAttribute('aria-pressed', 'false')

    // Act
    fireEvent.click(heart)

    // Assert
    await waitFor(async () => expect((await getQuote('l-1'))?.favorite).toBe(true), SLOW)
    await waitFor(() => expect(heart).toHaveAttribute('aria-pressed', 'true'))
  })

  it('switches to Favoriten when the drawer link navigates while the library is already mounted', async () => {
    // Arrange
    renderWithProviders(
      <>
        <Link to="/?view=favorites">fav-link</Link>
        <LibraryPage />
      </>
    )
    await waitFor(() => expect(useQuoteStore.getState().loading).toBe(false))
    expect(screen.getByRole('button', { name: en.libraryViewSignal })).toHaveAttribute('aria-pressed', 'true')

    // Act
    fireEvent.click(screen.getByText('fav-link'))

    // Assert
    await waitFor(() => expect(screen.getByRole('button', { name: en.libraryViewFavorites })).toHaveAttribute('aria-pressed', 'true'))
  })

  it('shows a toast when toggling the heart fails', async () => {
    // Arrange
    await renderLibrary()
    const card = (await screen.findByText('"Signaltext"')).closest('article') as HTMLElement
    const { toggleFavorite } = useQuoteStore.getState()
    act(() => {
      useQuoteStore.setState({ toggleFavorite: () => Promise.reject(new Error('boom')) })
    })

    // Act
    fireEvent.click(card.querySelector('button[aria-label="' + en.favorite + '"]') as HTMLElement)

    // Assert
    try {
      await waitFor(() => expect(useToastStore.getState().toast?.message).toBe(en.saveFailed), SLOW)
    } finally {
      useQuoteStore.setState({ toggleFavorite })
      useToastStore.setState({ toast: null })
    }
  })
})
