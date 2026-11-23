import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, getQuote, listQuotes, upsertBooks as upsertBooksForTest, upsertQuotes } from '../db/database'
import { translations } from '../i18n/translations'
import { coachKey } from '../services/coach'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { useToastStore } from '../store/useToastStore'
import { makeBook, makeQuote, resetFactories } from '../test/factories'
import { renderWithProviders } from '../test/render'
import { InboxPage } from './InboxPage'

const en = translations.en

async function seedInbox() {
  await upsertQuotes([
    makeQuote({
      id: 'i-1',
      text: 'Erste Notiz',
      status: 'inbox',
      tags: ['alpha'],
      createdAt: '2026-01-01T09:00:00.000Z'
    }),
    makeQuote({
      id: 'i-2',
      text: 'Zweite Notiz',
      status: 'inbox',
      tags: ['beta'],
      createdAt: '2026-01-01T10:00:00.000Z'
    }),
    makeQuote({ id: 'i-3', text: 'Dritte Notiz', status: 'inbox', createdAt: '2026-01-01T11:00:00.000Z' })
  ])
}

// Waits until the page's mount-time loads are done, so no query is still running when the next test resets the database.
async function renderInbox() {
  const result = renderWithProviders(<InboxPage />)
  await waitFor(() => {
    expect(useQuoteStore.getState().loading).toBe(false)
    expect(useBookStore.getState().loading).toBe(false)
  })
  return result
}

// The capture form and the draft form both render a strength control and a finish button; the draft's come last.
function lastButton(name: string) {
  const buttons = screen.getAllByRole('button', { name })
  return buttons[buttons.length - 1]
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function currentCardText() {
  return screen.getByRole('blockquote').textContent
}

function swipeCard(dx: number, dy: number) {
  const card = screen.getByRole('blockquote').closest('article') as HTMLElement
  fireEvent.pointerDown(card, { pointerId: 1, clientX: 200, clientY: 300 })
  fireEvent.pointerMove(card, { pointerId: 1, clientX: 200 + dx, clientY: 300 + dy })
  fireEvent.pointerUp(card, { pointerId: 1, clientX: 200 + dx, clientY: 300 + dy })
}

beforeEach(async () => {
  resetFactories()
  await db.delete()
  await db.open()
  useQuoteStore.setState({ quotes: [], loading: true })
  useBookStore.setState({ books: [], loading: true })
  useToastStore.setState({ toast: null })
  localStorage.setItem(coachKey, 'true')
  // jsdom has no pointer capture (used by the swipe deck).
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('InboxPage', () => {
  describe('Kopf', () => {
    it('zeigt Titel, Klär-Frage und dann direkt den Stapel', async () => {
      // Arrange
      await seedInbox()

      // Act
      await renderInbox()
      const card = await screen.findByRole('blockquote')

      // Assert
      const title = screen.getByRole('heading', { level: 1, name: 'Clarify' })
      const question = screen.getByText(en.clarifyQuestion)
      expect(title.previousElementSibling).toBeNull()
      expect(title.compareDocumentPosition(question)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
      expect(question.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('hat keine doppelte Überschrift und keine Erklärtexte mehr', async () => {
      // Arrange
      await seedInbox()

      // Act
      await renderInbox()
      await screen.findByRole('blockquote')

      // Assert
      expect(screen.getAllByRole('heading')).toHaveLength(1)
      expect(screen.queryByText('Clarify noise')).not.toBeInTheDocument()
      expect(screen.queryByText('Clarifying stack')).not.toBeInTheDocument()
      expect(screen.queryByText(/Capture raw thoughts, photos/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Work through raw moments one by one/)).not.toBeInTheDocument()
    })

    it('behält die Aktion „Rauschen erfassen“', async () => {
      // Arrange / Act
      await renderInbox()

      // Assert
      expect(screen.getByRole('button', { name: en.openCapture })).toBeInTheDocument()
    })
  })

  it('zeigt die Klär-Frage im Kopf der Klären-Seite', async () => {
    // Arrange / Act
    await renderInbox()

    // Assert
    expect(screen.getByText(en.clarifyQuestion)).toBeInTheDocument()
  })

  it('zeigt bei einem 22 Tage alten Eintrag den Altershinweis', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'old', status: 'inbox', createdAt: daysAgo(22) })])

    // Act
    await renderInbox()

    // Assert
    expect(await screen.findByText('unclarified for 22 days')).toBeInTheDocument()
  })

  it('zeigt bei einem 6 Tage alten Eintrag keinen Altershinweis', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'young', status: 'inbox', createdAt: daysAgo(6) })])

    // Act
    await renderInbox()

    // Assert
    await screen.findByRole('blockquote')
    expect(screen.queryByText(/unclarified for/)).not.toBeInTheDocument()
  })

  it('zeigt den Leerzustand, wenn nichts im Eingang liegt', async () => {
    // Arrange / Act
    await renderInbox()

    // Assert
    expect(await screen.findByText(en.inboxEmptyTitle)).toBeInTheDocument()
  })

  it('zeigt den ältesten Eintrag zuerst samt Fortschritt', async () => {
    // Arrange
    await seedInbox()

    // Act
    await renderInbox()

    // Assert
    await screen.findByRole('blockquote')
    expect(currentCardText()).toBe('"Erste Notiz"')
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
  })

  it('blendet zurückgestellte Einträge aus und zeigt abgelaufene wieder an', async () => {
    // Arrange
    await upsertQuotes([
      makeQuote({ text: 'Später', status: 'inbox', snoozedUntil: '2999-01-01T08:00:00.000Z' }),
      makeQuote({ text: 'Wieder da', status: 'inbox', snoozedUntil: '2000-01-01T08:00:00.000Z' })
    ])

    // Act
    await renderInbox()

    // Assert
    await screen.findByRole('blockquote')
    expect(currentCardText()).toBe('"Wieder da"')
    expect(screen.getByText('1 of 1')).toBeInTheDocument()
  })

  it('zeigt einen zurückgestellten Eintrag nach dem nächsten Neuladen wieder, sobald die Zeit abgelaufen ist', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-03-01T08:00:00.000Z'))
    await upsertQuotes([
      makeQuote({
        id: 's-1',
        text: 'Schlummert',
        status: 'inbox',
        snoozedUntil: '2026-03-01T09:00:00.000Z',
        createdAt: '2026-01-01T09:00:00.000Z'
      }),
      makeQuote({ id: 's-2', text: 'Wach', status: 'inbox', createdAt: '2026-01-02T09:00:00.000Z' })
    ])
    await renderInbox()
    await screen.findByRole('blockquote')
    expect(currentCardText()).toBe('"Wach"')

    // Act
    vi.setSystemTime(new Date('2026-03-01T10:00:00.000Z'))
    await act(async () => {
      await useQuoteStore.getState().loadQuotes()
    })

    // Assert
    await waitFor(() => expect(screen.getByText('1 of 2')).toBeInTheDocument())
    expect(currentCardText()).toBe('"Schlummert"')
  })

  it('übernimmt den Eintrag per "Signal" in die Signale und zeigt den nächsten', async () => {
    // Arrange
    await seedInbox()
    await renderInbox()
    await screen.findByRole('blockquote')

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.finishSignal }))

    // Assert
    expect(await screen.findByText(en.movedToSignals)).toBeInTheDocument()
    await waitFor(() => expect(currentCardText()).toBe('"Zweite Notiz"'))
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
    expect((await getQuote('i-1'))?.status).toBe('signal')
  })

  it('stellt einen Eintrag per "Später" zurück und zeigt einen Hinweis', async () => {
    // Arrange
    await seedInbox()
    await renderInbox()
    await screen.findByRole('blockquote')

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.later }))

    // Assert
    await waitFor(() => expect(currentCardText()).toBe('"Zweite Notiz"'))
    expect(useToastStore.getState().toast?.message).toBe(en.snoozedToast)
    expect((await getQuote('i-1'))?.snoozedUntil).toBeTruthy()
  })

  it('legt einen Eintrag per Wisch nach unten in die Stille statt ihn zu löschen', async () => {
    // Arrange
    await seedInbox()
    await renderInbox()
    await screen.findByRole('blockquote')

    // Act
    swipeCard(0, 160)

    // Assert
    await waitFor(() => expect(currentCardText()).toBe('"Zweite Notiz"'), { timeout: 3000 })
    const stored = await getQuote('i-1')
    expect(stored?.status).toBe('rest')
    expect(stored?.deletedAt).toBeUndefined()
    expect(useToastStore.getState().toast).toMatchObject({ message: en.restedToast, actionLabel: en.undo })
    await waitFor(() => expect(useQuoteStore.getState().quotes.find((quote) => quote.id === 'i-1')?.status).toBe('rest'))
  })

  it('legt einen Eintrag per Stille-Taste zur Ruhe und holt ihn per Rückgängig ins Rauschen zurück', async () => {
    // Arrange
    await seedInbox()
    await renderInbox()
    await screen.findByRole('blockquote')
    fireEvent.click(screen.getByRole('button', { name: en.clarifyRest }))
    await waitFor(() => expect(currentCardText()).toBe('"Zweite Notiz"'))

    // Act
    await act(async () => useToastStore.getState().toast?.onAction?.())

    // Assert
    await waitFor(() => expect(currentCardText()).toBe('"Erste Notiz"'))
    expect((await getQuote('i-1'))?.status).toBe('inbox')
  })

  it('löscht einen Eintrag nur über die ausdrückliche Löschen-Taste in den Papierkorb, mit Rückgängig', async () => {
    // Arrange
    await seedInbox()
    await renderInbox()
    await screen.findByRole('blockquote')

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.deleteEntry }))

    // Assert
    await waitFor(() => expect(currentCardText()).toBe('"Zweite Notiz"'))
    expect(useToastStore.getState().toast).toMatchObject({ message: en.discardedToast, actionLabel: en.undo })
    expect((await getQuote('i-1'))?.deletedAt).toBeTruthy()
  })

  it('beschreibt ↓ im Gestenhinweis als Stille und nicht als Verwerfen', async () => {
    // Arrange
    await seedInbox()

    // Act
    await renderInbox()
    await screen.findByRole('blockquote')

    // Assert
    expect(screen.getByText(en.clarifyGestureHint)).toHaveTextContent(/Down: rest/)
    expect(screen.getByText(en.clarifyGestureHint)).not.toHaveTextContent(/discard/i)
  })

  it('füllt den Entwurf beim Öffnen der Details mit den Werten des Eintrags', async () => {
    // Arrange
    await seedInbox()
    await renderInbox()
    await screen.findByRole('blockquote')

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.detailsAction }))

    // Assert
    expect(await screen.findByLabelText(en.text)).toHaveValue('Erste Notiz')
    expect(screen.getByLabelText(en.tags)).toHaveValue('alpha')
  })

  it('speichert Änderungen aus den Details, ohne den Eintrag zu verlassen', async () => {
    // Arrange
    await seedInbox()
    await renderInbox()
    await screen.findByRole('blockquote')
    fireEvent.click(screen.getByRole('button', { name: en.detailsAction }))
    fireEvent.change(await screen.findByLabelText(en.text), { target: { value: 'Erste Notiz, überarbeitet' } })

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.saveDetails }))

    // Assert
    expect(await screen.findByText(en.keptInNoise)).toBeInTheDocument()
    expect((await getQuote('i-1'))?.text).toBe('Erste Notiz, überarbeitet')
    expect((await getQuote('i-1'))?.status).toBe('inbox')
  })

  it('behält den Entwurf, wenn derselbe Eintrag neu geladen wird', async () => {
    // Arrange
    await seedInbox()
    await renderInbox()
    await screen.findByRole('blockquote')
    fireEvent.click(screen.getByRole('button', { name: en.detailsAction }))
    fireEvent.change(await screen.findByLabelText(en.firstThoughtLabel), { target: { value: 'Mein Entwurf' } })

    // Act
    await act(async () => {
      await useQuoteStore.getState().loadQuotes()
    })

    // Assert
    expect(screen.getByLabelText(en.firstThoughtLabel)).toHaveValue('Mein Entwurf')
  })

  it('schließt die Details und setzt den Entwurf zurück, wenn ein anderer Eintrag oben liegt', async () => {
    // Arrange
    await seedInbox()
    await renderInbox()
    await screen.findByRole('blockquote')
    fireEvent.click(screen.getByRole('button', { name: en.detailsAction }))
    fireEvent.change(await screen.findByLabelText(en.text), { target: { value: 'Ungespeichert' } })

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.later }))
    await waitFor(() => expect(currentCardText()).toBe('"Zweite Notiz"'))

    // Assert
    expect(screen.queryByLabelText(en.text)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: en.detailsAction }))
    expect(await screen.findByLabelText(en.text)).toHaveValue('Zweite Notiz')
    expect(screen.getByLabelText(en.tags)).toHaveValue('beta')
  })

  it('zeigt den Gesten-Coach beim ersten Besuch und merkt sich das Schließen', async () => {
    // Arrange
    localStorage.removeItem(coachKey)
    await seedInbox()
    await renderInbox()

    // Act
    const gotIt = await screen.findByRole('button', { name: en.coachGotIt })
    fireEvent.click(gotIt)

    // Assert
    expect(screen.queryByRole('dialog', { name: en.gestures })).not.toBeInTheDocument()
    expect(localStorage.getItem(coachKey)).toBe('true')
  })

  it('zeigt den Gesten-Coach nicht, wenn er schon gesehen wurde', async () => {
    // Arrange
    await seedInbox()

    // Act
    await renderInbox()
    await screen.findByRole('blockquote')

    // Assert
    expect(screen.queryByRole('dialog', { name: en.gestures })).not.toBeInTheDocument()
  })

  describe('Schnellerfassung', () => {
    it('sperrt das Speichern, solange nichts erfasst ist', async () => {
      // Arrange / Act
      await renderInbox()

      // Assert
      expect(screen.getByRole('button', { name: en.captureNoise })).toBeDisabled()
    })

    it('legt einen Eintrag im Eingang an, meldet das und leert das Formular', async () => {
      // Arrange
      await renderInbox()
      fireEvent.change(screen.getByPlaceholderText(en.noisePlaceholder), { target: { value: '  Neuer Gedanke  ' } })
      fireEvent.change(screen.getByPlaceholderText(en.noiseTagsPlaceholder), { target: { value: 'eins, , zwei ' } })

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.captureNoise }))

      // Assert
      expect(await screen.findByText(en.noiseSaved)).toBeInTheDocument()
      const saved = (await listQuotes()).find((quote) => quote.text === 'Neuer Gedanke')
      expect(saved).toMatchObject({ status: 'inbox', tags: ['eins', 'zwei'] })
      expect(saved?.signalStrength).toBeUndefined()
      expect(saved?.entryType).toBeUndefined()
      expect(screen.getByPlaceholderText(en.noisePlaceholder)).toHaveValue('')
      expect(screen.getByPlaceholderText(en.noiseTagsPlaceholder)).toHaveValue('')
      expect(screen.getByRole('button', { name: en.captureNoise })).toBeDisabled()
    })

    it('bietet im Erfassen-Formular keine Signalstärke mehr an', async () => {
      // Arrange
      await renderInbox()
      const form = screen.getByRole('button', { name: en.captureNoise }).closest('form') as HTMLElement

      // Assert
      expect(within(form).queryByText(/signal strength/i)).not.toBeInTheDocument()
    })
  })

  describe('Karte', () => {
    it('zeigt Notiz und die folgenden Karten als Vorschau', async () => {
      // Arrange
      await upsertQuotes([
        makeQuote({
          id: 'c-1',
          text: 'Oben',
          status: 'inbox',
          note: 'Eine Anmerkung',
          createdAt: '2026-01-01T09:00:00.000Z'
        }),
        makeQuote({ id: 'c-2', text: 'Mitte', status: 'inbox', createdAt: '2026-01-01T10:00:00.000Z' }),
        makeQuote({ id: 'c-3', text: 'Unten', status: 'inbox', createdAt: '2026-01-01T11:00:00.000Z' })
      ])

      // Act
      await renderInbox()

      // Assert
      await screen.findByRole('blockquote')
      expect(screen.getByText('Eine Anmerkung')).toBeInTheDocument()
      expect(screen.getByText('"Mitte"')).toHaveAttribute('class', expect.stringContaining('line-clamp-4'))
      expect(screen.getByText('"Unten"')).toHaveAttribute('class', expect.stringContaining('line-clamp-4'))
    })

    it('zeigt für reine Foto- und Sprachnotizen einen Platzhaltertitel', async () => {
      // Arrange
      await upsertQuotes([
        makeQuote({
          id: 'p-1',
          text: '',
          status: 'inbox',
          imageDataUrl: 'data:image/png;base64,AAAA',
          createdAt: '2026-01-01T09:00:00.000Z'
        }),
        makeQuote({
          id: 'p-2',
          text: '',
          status: 'inbox',
          audioDataUrl: 'data:audio/webm;base64,AAAA',
          createdAt: '2026-01-01T10:00:00.000Z'
        })
      ])
      await renderInbox()

      // Assert
      const photo = await screen.findByAltText(en.photoNote)
      expect(photo).toHaveAttribute('src', 'data:image/png;base64,AAAA')
      expect(screen.getAllByText(en.untitledPhotoNote).length).toBeGreaterThan(0)

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.later }))

      // Assert
      await waitFor(() => expect(screen.queryByAltText(en.photoNote)).not.toBeInTheDocument())
      expect(screen.getByText(en.untitledVoiceNote)).toBeInTheDocument()
      expect(document.querySelector('audio')).toHaveAttribute('src', 'data:audio/webm;base64,AAAA')
    })
  })

  describe('Details', () => {
    async function openDetails() {
      await seedInbox()
      await renderInbox()
      await screen.findByRole('blockquote')
      fireEvent.click(screen.getByRole('button', { name: en.detailsAction }))
      await screen.findByLabelText(en.text)
    }

    it('klappt die Details über dieselbe Taste wieder zu', async () => {
      // Arrange
      await openDetails()

      // Act
      fireEvent.click(screen.getAllByRole('button', { name: en.detailsAction })[0])

      // Assert
      expect(screen.queryByLabelText(en.text)).not.toBeInTheDocument()
    })

    it('zeigt Text, Autor, Tags und Ersten Gedanken sofort und versteckt die seltenen Felder', async () => {
      // Arrange / Act
      await openDetails()

      // Assert
      expect(screen.getByLabelText(en.text)).toBeInTheDocument()
      expect(screen.getByLabelText(en.author)).toBeInTheDocument()
      expect(screen.getByLabelText(en.tags)).toBeInTheDocument()
      expect(screen.getByLabelText(en.firstThoughtLabel)).toBeInTheDocument()
      for (const label of [en.people, en.occurredAt, en.work, en.year, en.note, en.source]) {
        expect(screen.queryByLabelText(label)).not.toBeInTheDocument()
      }
      expect(screen.getByRole('button', { name: en.moreDetails })).toHaveAttribute('aria-expanded', 'false')
    })

    it('zeigt das Buch-Feld sofort, sobald Bücher vorhanden sind', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'b-q', text: 'Zitat', status: 'inbox' })])
      await upsertBooksForTest([makeBook({ id: 'bk-1', title: 'Der Titel', author: 'Die Autorin' })])
      await renderInbox()
      await screen.findByRole('blockquote')

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.detailsAction }))

      // Assert
      expect(await screen.findByLabelText(en.book)).toBeInTheDocument()
    })

    it('blendet die seltenen Felder über „Mehr Details“ ein und wieder aus', async () => {
      // Arrange
      await openDetails()

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.moreDetails }))

      // Assert
      for (const label of [en.people, en.occurredAt, en.work, en.year, en.note]) {
        expect(screen.getByLabelText(label)).toBeInTheDocument()
      }
      fireEvent.click(screen.getByRole('button', { name: en.moreDetails }))
      expect(screen.queryByLabelText(en.people)).not.toBeInTheDocument()
    })

    it.each([
      ['Werk', { work: 'Walden' }, () => en.work, 'Walden'],
      ['Jahr', { year: '1854' }, () => en.year, '1854'],
      ['Beschreibung', { note: 'Etwas dazu' }, () => en.note, 'Etwas dazu'],
      ['Personen', { people: ['Anna'] }, () => en.people, 'Anna'],
      ['Datum', { occurredAt: '2026-03-04T09:30:00.000Z' }, () => en.occurredAt, '2026-03-04T10:30'],
      ['Quelle', { source: 'Brief' }, () => en.source, 'Brief']
    ])('öffnet „Mehr Details“ automatisch, wenn %s schon einen Wert hat', async (_name, fields, label, value) => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'w-1', text: 'Zitat', status: 'inbox', ...fields })])
      await renderInbox()
      await screen.findByRole('blockquote')

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.detailsAction }))

      // Assert
      expect(await screen.findByLabelText(label())).toHaveValue(value)
      expect(screen.getByRole('button', { name: en.moreDetails })).toHaveAttribute('aria-expanded', 'true')
    })

    it('bietet in den Details weder Art, Signalstärke noch Ort an', async () => {
      // Arrange
      await openDetails()

      // Assert
      const form = screen.getByLabelText(en.text).closest('div') as HTMLElement
      expect(within(form).queryByText(/signal strength/i)).not.toBeInTheDocument()
      expect(within(form).queryByText(/location/i)).not.toBeInTheDocument()
      expect(form.querySelectorAll('button[aria-pressed]')).toHaveLength(0)
    })

    it('übernimmt Titel und Autor aus dem gewählten Buch', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'b-q', text: 'Zitat', status: 'inbox' })])
      await upsertBooksForTest([makeBook({ id: 'bk-1', title: 'Der Titel', author: 'Die Autorin' })])
      await renderInbox()
      await screen.findByRole('blockquote')
      fireEvent.click(screen.getByRole('button', { name: en.detailsAction }))

      // Act
      fireEvent.change(await screen.findByLabelText(en.book), { target: { value: 'bk-1' } })

      // Assert
      expect(screen.getByLabelText(en.author)).toHaveValue('Die Autorin')
      fireEvent.click(screen.getByRole('button', { name: en.moreDetails }))
      expect(screen.getByLabelText(en.work)).toHaveValue('Der Titel')
      expect(screen.getByRole('option', { name: 'Der Titel - Die Autorin' })).toBeInTheDocument()
    })

    it('lässt „Mehr Details“ zu, wenn die Buchwahl nur Werk mit dem Buchtitel füllt', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'b-q', text: 'Zitat', status: 'inbox' })])
      await upsertBooksForTest([makeBook({ id: 'bk-1', title: 'Der Titel' })])
      await renderInbox()
      await screen.findByRole('blockquote')
      fireEvent.click(screen.getByRole('button', { name: en.detailsAction }))
      expect(screen.getByRole('button', { name: en.moreDetails })).toHaveAttribute('aria-expanded', 'false')

      // Act
      fireEvent.change(await screen.findByLabelText(en.book), { target: { value: 'bk-1' } })

      // Assert
      expect(screen.getByRole('button', { name: en.moreDetails })).toHaveAttribute('aria-expanded', 'false')
      expect(screen.getByLabelText(en.author)).toBeInTheDocument()
    })

    it('behält die Überschriften-Reihenfolge h1, h2 auch mit geöffneten Details', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'b-q', text: 'Zitat', status: 'inbox' })])
      await renderInbox()
      await screen.findByRole('blockquote')

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.detailsAction }))

      // Assert
      const levels = screen.getAllByRole('heading').map((heading) => heading.tagName)
      expect(levels).toEqual(['H1', 'H2'])
    })

    it('klappt „Mehr Details“ nach der Buchwahl per Klick ein und aus', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'b-q', text: 'Zitat', status: 'inbox' })])
      await upsertBooksForTest([makeBook({ id: 'bk-1', title: 'Der Titel' })])
      await renderInbox()
      await screen.findByRole('blockquote')
      fireEvent.click(screen.getByRole('button', { name: en.detailsAction }))
      fireEvent.click(screen.getByRole('button', { name: en.moreDetails }))
      fireEvent.change(await screen.findByLabelText(en.book), { target: { value: 'bk-1' } })
      expect(screen.getByLabelText(en.work)).toHaveValue('Der Titel')

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.moreDetails }))

      // Assert
      expect(screen.getByRole('button', { name: en.moreDetails })).toHaveAttribute('aria-expanded', 'false')
    })

    it('speichert den bereinigten Entwurf beim Abschluss als Signal', async () => {
      // Arrange
      await upsertQuotes([
        makeQuote({
          id: 'f-1',
          text: 'Roh',
          status: 'inbox',
          nextReviewAt: '2026-02-01T09:00:00.000Z',
          signalStrength: 'strong',
          entryType: 'idea',
          locationName: 'Eilenriede',
          locationLatitude: 52.38,
          locationLongitude: 9.76
        })
      ])
      await renderInbox()
      await screen.findByRole('blockquote')
      fireEvent.click(screen.getByRole('button', { name: en.detailsAction }))
      fireEvent.change(await screen.findByLabelText(en.text), { target: { value: '  Fertig  ' } })
      fireEvent.change(screen.getByLabelText(en.tags), { target: { value: 'Gross, KLEIN' } })
      fireEvent.click(screen.getByRole('button', { name: en.moreDetails }))
      fireEvent.change(screen.getByLabelText(en.people), { target: { value: 'Anna,  Bob ' } })
      fireEvent.change(screen.getByLabelText(en.note), { target: { value: '   ' } })
      fireEvent.change(screen.getByLabelText(en.occurredAt), { target: { value: '2026-03-04T10:30' } })

      // Act
      fireEvent.click(lastButton(en.finishSignal))

      // Assert
      expect(await screen.findByText(en.movedToSignals)).toBeInTheDocument()
      const saved = await getQuote('f-1')
      expect(saved).toMatchObject({
        text: 'Fertig',
        status: 'signal',
        tags: ['gross', 'klein'],
        people: ['Anna', 'Bob']
      })
      // Gespeicherte, nicht mehr bearbeitbare Werte bleiben unverändert erhalten.
      expect(saved).toMatchObject({
        signalStrength: 'strong',
        entryType: 'idea',
        locationName: 'Eilenriede',
        locationLatitude: 52.38,
        locationLongitude: 9.76
      })
      expect(saved?.note).toBeUndefined()
      expect(saved?.reviewIntervalDays).toBe(1)
      expect(new Date(saved?.nextReviewAt ?? '').getHours()).toBe(6)
      expect(new Date(saved?.occurredAt ?? '').getTime()).toBe(new Date('2026-03-04T10:30').getTime())
    })

    it('behält beim Speichern der Details den nächsten Wiedervorlagetermin', async () => {
      // Arrange
      await upsertQuotes([
        makeQuote({ id: 'k-1', text: 'Bleibt', status: 'inbox', nextReviewAt: '2026-02-01T09:00:00.000Z' })
      ])
      await renderInbox()
      await screen.findByRole('blockquote')
      fireEvent.click(screen.getByRole('button', { name: en.detailsAction }))
      fireEvent.click(await screen.findByRole('button', { name: en.moreDetails }))
      fireEvent.change(await screen.findByLabelText(en.note), { target: { value: 'Notiz dazu' } })

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.saveDetails }))

      // Assert
      await screen.findByText(en.keptInNoise)
      const saved = await getQuote('k-1')
      expect(saved).toMatchObject({ status: 'inbox', note: 'Notiz dazu', nextReviewAt: '2026-02-01T09:00:00.000Z' })
    })

    it('speichert den ersten Gedanken bei zweimaligem Speichern nur einmal', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 't-1', text: 'Roh', status: 'inbox' })])
      await renderInbox()
      await screen.findByRole('blockquote')
      fireEvent.click(screen.getByRole('button', { name: en.detailsAction }))
      fireEvent.change(await screen.findByLabelText(en.firstThoughtLabel), { target: { value: 'Mein Gedanke' } })

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.saveDetails }))
      await waitFor(async () => expect((await getQuote('t-1'))?.thoughts).toHaveLength(1))
      await waitFor(() => expect(screen.getByLabelText(en.firstThoughtLabel)).toHaveValue(''))
      fireEvent.click(screen.getByRole('button', { name: en.saveDetails }))

      // Assert
      await waitFor(async () => expect((await getQuote('t-1'))?.updatedAt).toBeTruthy())
      expect((await getQuote('t-1'))?.thoughts?.map((thought) => thought.text)).toEqual(['Mein Gedanke'])
    })
  })
})
