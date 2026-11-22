import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, upsertQuotes } from '../db/database'
import { de } from '../i18n/locales/de'
import { en } from '../i18n/locales/en'
import * as importExport from '../services/importExport'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { makeQuote, resetFactories } from '../test/factories'
import { renderWithProviders } from '../test/render'
import { ReflectionsPage } from './ReflectionsPage'

beforeEach(async () => {
  // Only Date is faked (a Wednesday noon), so "minutes ago" never crosses a week boundary and waitFor keeps real timers.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-03-11T12:00:00+01:00'))
  resetFactories()
  await db.delete()
  await db.open()
  useQuoteStore.setState({ quotes: [], loading: false })
  useBookStore.setState({ books: [], loading: false })
})

afterEach(() => {
  localStorage.removeItem('quiet-signal-language')
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/reflections" element={<ReflectionsPage />} />
      <Route path="/quote/:id" element={<p>Detail page</p>} />
    </Routes>,
    { route: '/reflections' }
  )
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

describe('ReflectionsPage', () => {
  it('zeigt die Gedanken der Woche als Wand, neueste zuerst, mit Werk und früherer Notiz', async () => {
    // Arrange
    await upsertQuotes([
      makeQuote({
        id: 'a',
        author: 'Seneca',
        work: 'Briefe',
        thoughts: [
          { id: 't1', text: 'Älterer Gedanke', createdAt: minutesAgo(2) },
          { id: 't2', text: 'Neuer Gedanke', createdAt: minutesAgo(1) }
        ]
      }),
      makeQuote({ id: 'b', thoughts: [{ id: 't3', text: 'Aus der Notiz', createdAt: minutesAgo(3), fromNote: true }] })
    ])

    // Act
    renderPage()

    // Assert
    const wall = await screen.findByRole('region', { name: en.reflectionThoughtsTitle })
    const items = within(wall).getAllByRole('listitem')
    expect(items.map((item) => item.querySelector('[data-thought-text]')?.textContent)).toEqual([
      'Neuer Gedanke',
      'Älterer Gedanke',
      'Aus der Notiz'
    ])
    expect(items[0]).toHaveTextContent('Seneca, Briefe')
    expect(items[2]).toHaveTextContent(en.fromNote)
  })

  it('öffnet beim Antippen eines Gedankens das Zitat', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'a', thoughts: [{ id: 't1', text: 'Tipp mich', createdAt: minutesAgo(1) }] })])
    renderPage()

    // Act
    fireEvent.click(await screen.findByRole('link', { name: /Tipp mich/ }))

    // Assert
    expect(await screen.findByText('Detail page')).toBeInTheDocument()
  })

  it('zeigt den Gezeitenstreifen mit zugänglicher Zusammenfassung und Summenzeile', async () => {
    // Arrange
    localStorage.setItem('quiet-signal-language', 'de')
    await upsertQuotes([
      makeQuote({
        id: 'a',
        activity: [
          { at: minutesAgo(5), type: 'more' },
          { at: minutesAgo(4), type: 'more' },
          { at: minutesAgo(3), type: 'rest' },
          { at: minutesAgo(2), type: 'rest' }
        ]
      }),
      makeQuote({ id: 'b', activity: [{ at: minutesAgo(1), type: 'more' }] })
    ])

    // Act
    renderPage()

    // Assert
    const summary = '2 durften ruhen · 3 wolltest du öfter sehen'
    const strip = await screen.findByRole('img', { name: new RegExp(summary) })
    expect(strip).toBeInTheDocument()
    expect(screen.getByText(summary)).toBeInTheDocument()
    expect(screen.getByText(de.reflectionEmptyWeek)).toBeInTheDocument()
  })

  it('nutzt die Einzahl in der Summenzeile', async () => {
    // Arrange
    localStorage.setItem('quiet-signal-language', 'de')
    await upsertQuotes([makeQuote({ activity: [{ at: minutesAgo(2), type: 'rest' }, { at: minutesAgo(1), type: 'more' }] })])

    // Act
    renderPage()

    // Assert
    expect(await screen.findByText('1 durfte ruhen · 1 wolltest du öfter sehen')).toBeInTheDocument()
  })

  it('zeigt im leeren Zeitraum den Hinweis für Woche und Monat', async () => {
    // Arrange
    localStorage.setItem('quiet-signal-language', 'de')
    renderPage()

    // Act
    expect(await screen.findByText('Diese Woche hast du nichts notiert. Beim nächsten ↑ landet der Gedanke hier.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: de.thisMonth }))

    // Assert
    expect(await screen.findByText(de.reflectionEmptyMonth)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: de.exportMarkdown })).not.toBeInTheDocument()
  })

  it('exportiert die Gedanken des Zeitraums als Markdown', async () => {
    // Arrange
    const download = vi.spyOn(importExport, 'downloadText').mockImplementation(() => undefined)
    await upsertQuotes([
      makeQuote({ text: 'Der Satz', author: 'Autor', thoughts: [{ id: 't1', text: 'Exportierter Gedanke', createdAt: minutesAgo(1) }] })
    ])
    renderPage()

    // Act
    fireEvent.click(await screen.findByRole('button', { name: en.exportMarkdown }))

    // Assert
    expect(download).toHaveBeenCalledTimes(1)
    const [, markdown, type] = download.mock.calls[0]
    expect(type).toBe('text/markdown')
    expect(markdown).toContain('Exportierter Gedanke')
    expect(markdown).toContain('> Der Satz')
    expect(markdown).toContain('Autor')
  })

  it('zeigt keine Statistik-Abschnitte und kein „Als Signal speichern“ mehr', async () => {
    // Arrange
    await upsertQuotes([
      makeQuote({ tags: ['stille'], work: 'Walden', thoughts: [{ id: 't1', text: 'x', createdAt: minutesAgo(1) }] })
    ])

    // Act
    renderPage()

    // Assert
    await screen.findByRole('region', { name: en.reflectionThoughtsTitle })
    expect(screen.queryByRole('button', { name: /save as signal/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/time pattern/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/top tag/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /^(tags|books)$/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/^signals$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^noise$/i)).not.toBeInTheDocument()
    await waitFor(() => expect(useQuoteStore.getState().loading).toBe(false))
  })
})
