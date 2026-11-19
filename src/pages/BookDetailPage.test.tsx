import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, getBook, upsertBooks, upsertQuotes } from '../db/database'
import { translations } from '../i18n/translations'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { makeBook, makeQuote, resetFactories } from '../test/factories'
import { renderWithProviders } from '../test/render'
import { BookDetailPage } from './BookDetailPage'

const en = translations.en

function renderBook(id: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/books/:id" element={<BookDetailPage />} />
      <Route path="/books" element={<p>Bücherliste</p>} />
    </Routes>,
    { route: `/books/${id}` }
  )
}

beforeEach(async () => {
  resetFactories()
  await db.delete()
  await db.open()
  useQuoteStore.setState({ quotes: [] })
  useBookStore.setState({ books: [] })
})

describe('BookDetailPage', () => {
  it('zeigt einen Hinweis, wenn das Buch nicht existiert', async () => {
    // Arrange / Act
    renderBook('gibt-es-nicht')

    // Assert
    expect(await screen.findByText(en.bookNotFound)).toBeInTheDocument()
  })

  it('füllt Titel und Autor des Buchs in das Bearbeitungsformular', async () => {
    // Arrange
    await upsertBooks([makeBook({ id: 'b-x', title: 'Die Verwandlung', author: 'Franz Kafka' })])

    // Act
    renderBook('b-x')

    // Assert
    await waitFor(() => expect(screen.getByLabelText(en.bookTitleLabel)).toHaveValue('Die Verwandlung'))
    expect(screen.getByLabelText(en.bookAuthorLabel)).toHaveValue('Franz Kafka')
    expect(screen.getByText(en.bookEditHelp)).toBeInTheDocument()
  })

  it('speichert geänderte Angaben und zeigt die Erfolgsmeldung', async () => {
    // Arrange
    await upsertBooks([makeBook({ id: 'b-x', title: 'Die Verwandlung', author: 'Franz Kafka' })])
    renderBook('b-x')
    await waitFor(() => expect(screen.getByLabelText(en.bookTitleLabel)).toHaveValue('Die Verwandlung'))

    // Act
    fireEvent.change(screen.getByLabelText(en.bookTitleLabel), { target: { value: 'Der Prozess' } })
    fireEvent.click(screen.getByRole('button', { name: en.saveBook }))

    // Assert
    expect(await screen.findByText(en.bookUpdated)).toBeInTheDocument()
    expect(screen.getByLabelText(en.bookTitleLabel)).toHaveValue('Der Prozess')
    expect((await getBook('b-x'))?.title).toBe('Der Prozess')
  })

  it('übernimmt eine externe Änderung des Buchs in das Formular und verwirft die Meldung', async () => {
    // Arrange
    await upsertBooks([makeBook({ id: 'b-x', title: 'Die Verwandlung', author: 'Franz Kafka' })])
    renderBook('b-x')
    await waitFor(() => expect(screen.getByLabelText(en.bookTitleLabel)).toHaveValue('Die Verwandlung'))
    fireEvent.change(screen.getByLabelText(en.bookTitleLabel), { target: { value: 'Entwurf' } })
    fireEvent.click(screen.getByRole('button', { name: en.saveBook }))
    await screen.findByText(en.bookUpdated)

    // Act
    act(() => {
      useBookStore.setState({ books: [makeBook({ id: 'b-x', title: 'Das Schloss', author: 'F. Kafka' })] })
    })

    // Assert
    await waitFor(() => expect(screen.getByLabelText(en.bookTitleLabel)).toHaveValue('Das Schloss'))
    expect(screen.getByLabelText(en.bookAuthorLabel)).toHaveValue('F. Kafka')
    expect(screen.queryByText(en.bookUpdated)).not.toBeInTheDocument()
    expect(screen.getByText(en.bookEditHelp)).toBeInTheDocument()
  })

  it('behält ungespeicherte Eingaben, solange sich das Buch nicht ändert', async () => {
    // Arrange
    await upsertBooks([makeBook({ id: 'b-x', title: 'Die Verwandlung' }), makeBook({ id: 'b-y', title: 'Anderes Buch' })])
    renderBook('b-x')
    await waitFor(() => expect(screen.getByLabelText(en.bookTitleLabel)).toHaveValue('Die Verwandlung'))

    // Act
    fireEvent.change(screen.getByLabelText(en.bookTitleLabel), { target: { value: 'Halbfertig' } })
    act(() => {
      useBookStore.setState({ books: useBookStore.getState().books.map((book) => (book.id === 'b-y' ? { ...book, title: 'Umbenannt' } : book)) })
    })

    // Assert
    expect(screen.getByLabelText(en.bookTitleLabel)).toHaveValue('Halbfertig')
  })

  it('zeigt nur die Zitate des Buchs und löscht das Buch nach Bestätigung', async () => {
    // Arrange
    await upsertBooks([makeBook({ id: 'b-x', title: 'Die Verwandlung' })])
    await upsertQuotes([makeQuote({ text: 'Als Gregor Samsa erwachte', bookId: 'b-x' }), makeQuote({ text: 'Fremdes Zitat' })])
    renderBook('b-x')
    expect(await screen.findByText(/Als Gregor Samsa erwachte/)).toBeInTheDocument()
    expect(screen.queryByText(/Fremdes Zitat/)).not.toBeInTheDocument()

    // Act
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.deleteBook) }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === en.delete) as HTMLElement)

    // Assert
    expect(await screen.findByText('Bücherliste')).toBeInTheDocument()
    expect(await getBook('b-x')).toBeUndefined()
  })
})
