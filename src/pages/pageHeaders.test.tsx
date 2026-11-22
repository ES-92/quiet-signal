import { screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/database'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { resetFactories } from '../test/factories'
import { renderWithProviders } from '../test/render'
import { BooksPage } from './BooksPage'
import { GesturesPage } from './GesturesPage'
import { ImportExportPage } from './ImportExportPage'
import { InboxPage } from './InboxPage'
import { LibraryPage } from './LibraryPage'
import { ReflectionsPage } from './ReflectionsPage'
import { SettingsPage } from './SettingsPage'
import { TrashPage } from './TrashPage'

beforeEach(async () => {
  resetFactories()
  await db.delete()
  await db.open()
  useQuoteStore.setState({ quotes: [], loading: false })
  useBookStore.setState({ books: [], loading: false })
})

describe('Seitenköpfe', () => {
  it.each<[string, () => ReactElement]>([
    ['Klären', () => <InboxPage />],
    ['Sammlung', () => <LibraryPage />],
    ['Regal', () => <BooksPage />],
    ['Einstellungen', () => <SettingsPage />],
    ['Import/Export', () => <ImportExportPage />],
    ['Rückblick', () => <ReflectionsPage />],
    ['Papierkorb', () => <TrashPage />],
    ['Gesten', () => <GesturesPage />]
  ])('%s beginnt mit dem Titel ohne dekorative Zeile darüber', async (_name, page) => {
    // Arrange / Act
    renderWithProviders(page())

    // Assert
    const title = await screen.findByRole('heading', { level: 1 })
    expect(title.previousElementSibling).toBeNull()
    await waitFor(() => expect(useQuoteStore.getState().loading).toBe(false))
  })
})
