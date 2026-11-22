import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, getQuote, listTrashed, upsertQuotes } from '../db/database'
import { translations } from '../i18n/translations'
import { useQuoteStore } from '../store/useQuoteStore'
import { makeQuote, resetFactories } from '../test/factories'
import { renderWithProviders } from '../test/render'
import { TrashPage } from './TrashPage'

const en = translations.en
const DELETED_AT = '2026-01-02T09:00:00.000Z'

beforeEach(async () => {
  resetFactories()
  await db.delete()
  await db.open()
  useQuoteStore.setState({ quotes: [] })
})

describe('TrashPage', () => {
  it('zeigt den Leerzustand, wenn der Papierkorb leer ist', async () => {
    // Arrange / Act
    renderWithProviders(<TrashPage />)

    // Assert
    expect(await screen.findByText(en.trashEmptyTitle)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: en.emptyTrash })).not.toBeInTheDocument()
  })

  it('zeigt nach dem Laden die gelöschten Einträge, aber keine aktiven', async () => {
    // Arrange
    await upsertQuotes([
      makeQuote({ text: 'Gelöscht eins', deletedAt: DELETED_AT }),
      makeQuote({ text: 'Gelöscht zwei', deletedAt: DELETED_AT }),
      makeQuote({ text: 'Noch aktiv' })
    ])

    // Act
    renderWithProviders(<TrashPage />)

    // Assert
    expect(await screen.findByText('Gelöscht eins')).toBeInTheDocument()
    expect(screen.getByText('Gelöscht zwei')).toBeInTheDocument()
    expect(screen.queryByText('Noch aktiv')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: en.emptyTrash })).toBeInTheDocument()
  })

  it('stellt einen Eintrag wieder her und entfernt ihn aus der Liste', async () => {
    // Arrange
    await upsertQuotes([
      makeQuote({ id: 'weg-1', text: 'Gelöscht eins', deletedAt: DELETED_AT }),
      makeQuote({ id: 'weg-2', text: 'Gelöscht zwei', deletedAt: DELETED_AT })
    ])
    renderWithProviders(<TrashPage />)
    const item = (await screen.findByText('Gelöscht eins')).closest('li') as HTMLElement

    // Act
    fireEvent.click(within(item).getByRole('button', { name: en.restore }))

    // Assert
    await waitFor(() => expect(screen.queryByText('Gelöscht eins')).not.toBeInTheDocument())
    expect(screen.getByText('Gelöscht zwei')).toBeInTheDocument()
    expect((await getQuote('weg-1'))?.deletedAt).toBeUndefined()
  })

  it('leert den Papierkorb nach Bestätigung', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ text: 'Gelöscht eins', deletedAt: DELETED_AT })])
    renderWithProviders(<TrashPage />)
    await screen.findByText('Gelöscht eins')

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.emptyTrash }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: en.emptyTrash }))

    // Assert
    expect(await screen.findByText(en.trashEmptyTitle)).toBeInTheDocument()
    expect(await listTrashed()).toHaveLength(0)
  })

  it('stapelt den Leeren-Button unter den Einleitungstext und ordnet ihn ab sm nebeneinander an', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ text: 'Gelöscht', deletedAt: DELETED_AT })])

    // Act
    renderWithProviders(<TrashPage />)
    const button = await screen.findByRole('button', { name: en.emptyTrash })

    // Assert
    const header = button.closest('section') as HTMLElement
    expect(header.className).toContain('flex-col')
    expect(header.className).toContain('sm:flex-row')
    expect(header.className).not.toMatch(/(^|\s)items-end/)
    expect(button.className).toContain('self-start')
  })
})
