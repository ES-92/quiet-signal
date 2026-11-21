import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, getQuote, upsertQuotes } from '../db/database'
import { translations } from '../i18n/translations'
import { useQuoteStore } from '../store/useQuoteStore'
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
  it('shows only signals by default', async () => {
    // Arrange / Act
    await renderLibrary()

    // Assert
    expect(await screen.findByText('"Signaltext"')).toBeInTheDocument()
    expect(screen.queryByText('"Stilletext"')).not.toBeInTheDocument()
    expect(screen.queryByText('"Rauschtext"')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: en.libraryViewSignal })).toHaveAttribute('aria-pressed', 'true')
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
})
