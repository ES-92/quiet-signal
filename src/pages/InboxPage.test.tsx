import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, getQuote, upsertQuotes } from '../db/database'
import { translations } from '../i18n/translations'
import { coachKey } from '../services/coach'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { useToastStore } from '../store/useToastStore'
import { makeQuote, resetFactories } from '../test/factories'
import { renderWithProviders } from '../test/render'
import { InboxPage } from './InboxPage'

const en = translations.en

async function seedInbox() {
  await upsertQuotes([
    makeQuote({ id: 'i-1', text: 'Erste Notiz', status: 'inbox', tags: ['alpha'], createdAt: '2026-01-01T09:00:00.000Z' }),
    makeQuote({ id: 'i-2', text: 'Zweite Notiz', status: 'inbox', tags: ['beta'], createdAt: '2026-01-01T10:00:00.000Z' }),
    makeQuote({ id: 'i-3', text: 'Dritte Notiz', status: 'inbox', createdAt: '2026-01-01T11:00:00.000Z' })
  ])
}

function currentCardText() {
  return screen.getByRole('blockquote').textContent
}

beforeEach(async () => {
  resetFactories()
  await db.delete()
  await db.open()
  useQuoteStore.setState({ quotes: [] })
  useBookStore.setState({ books: [] })
  useToastStore.setState({ toast: null })
  localStorage.setItem(coachKey, 'true')
})

afterEach(() => {
  vi.useRealTimers()
})

describe('InboxPage', () => {
  it('zeigt den Leerzustand, wenn nichts im Eingang liegt', async () => {
    // Arrange / Act
    renderWithProviders(<InboxPage />)

    // Assert
    expect(await screen.findByText(en.inboxEmptyTitle)).toBeInTheDocument()
  })

  it('zeigt den ältesten Eintrag zuerst samt Fortschritt', async () => {
    // Arrange
    await seedInbox()

    // Act
    renderWithProviders(<InboxPage />)

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
    renderWithProviders(<InboxPage />)

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
      makeQuote({ id: 's-1', text: 'Schlummert', status: 'inbox', snoozedUntil: '2026-03-01T09:00:00.000Z', createdAt: '2026-01-01T09:00:00.000Z' }),
      makeQuote({ id: 's-2', text: 'Wach', status: 'inbox', createdAt: '2026-01-02T09:00:00.000Z' })
    ])
    renderWithProviders(<InboxPage />)
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
    renderWithProviders(<InboxPage />)
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
    renderWithProviders(<InboxPage />)
    await screen.findByRole('blockquote')

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.later }))

    // Assert
    await waitFor(() => expect(currentCardText()).toBe('"Zweite Notiz"'))
    expect(useToastStore.getState().toast?.message).toBe(en.snoozedToast)
    expect((await getQuote('i-1'))?.snoozedUntil).toBeTruthy()
  })

  it('verwirft einen Eintrag mit Rückgängig-Hinweis', async () => {
    // Arrange
    await seedInbox()
    renderWithProviders(<InboxPage />)
    await screen.findByRole('blockquote')

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.deleteNoise }))

    // Assert
    await waitFor(() => expect(currentCardText()).toBe('"Zweite Notiz"'))
    expect(useToastStore.getState().toast?.message).toBe(en.discardedToast)
    expect((await getQuote('i-1'))?.deletedAt).toBeTruthy()
  })

  it('füllt den Entwurf beim Öffnen der Details mit den Werten des Eintrags', async () => {
    // Arrange
    await seedInbox()
    renderWithProviders(<InboxPage />)
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
    renderWithProviders(<InboxPage />)
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
    renderWithProviders(<InboxPage />)
    await screen.findByRole('blockquote')
    fireEvent.click(screen.getByRole('button', { name: en.detailsAction }))
    fireEvent.change(await screen.findByLabelText(en.note), { target: { value: 'Mein Entwurf' } })

    // Act
    await act(async () => {
      await useQuoteStore.getState().loadQuotes()
    })

    // Assert
    expect(screen.getByLabelText(en.note)).toHaveValue('Mein Entwurf')
  })

  it('schließt die Details und setzt den Entwurf zurück, wenn ein anderer Eintrag oben liegt', async () => {
    // Arrange
    await seedInbox()
    renderWithProviders(<InboxPage />)
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
    renderWithProviders(<InboxPage />)

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
    renderWithProviders(<InboxPage />)
    await screen.findByRole('blockquote')

    // Assert
    expect(screen.queryByRole('dialog', { name: en.gestures })).not.toBeInTheDocument()
  })
})
