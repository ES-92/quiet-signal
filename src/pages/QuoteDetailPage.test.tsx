import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, getQuote, upsertQuotes } from '../db/database'
import { translations } from '../i18n/translations'
import { reviewDateFromInterval } from '../services/lifecycle'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { useToastStore } from '../store/useToastStore'
import { makeQuote, resetFactories } from '../test/factories'
import { renderWithProviders } from '../test/render'
import type { Thought } from '../types/quote'
import { QuoteDetailPage } from './QuoteDetailPage'

const en = translations.en
const SLOW = { timeout: 3000 }

const thought: Thought = { id: 'th-1', text: 'Erster Gedanke', createdAt: '2026-01-02T09:00:00.000Z' }

async function renderDetail(id = 'q-1') {
  const result = renderWithProviders(
    <Routes>
      <Route path="/quote/:id" element={<QuoteDetailPage />} />
    </Routes>,
    { route: `/quote/${id}` }
  )
  await waitFor(() => {
    expect(useQuoteStore.getState().loading).toBe(false)
    expect(useBookStore.getState().loading).toBe(false)
  })
  await screen.findByText(en.edit)
  return result
}

beforeEach(async () => {
  resetFactories()
  await db.delete()
  await db.open()
  useQuoteStore.setState({ quotes: [], loading: true })
  useBookStore.setState({ books: [], loading: true })
  useToastStore.setState({ toast: null })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('QuoteDetailPage', () => {
  it('shows the like count only quietly as text, without a like control or metric tiles', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'q-1', text: 'Geliebt', likes: 3, signalStrength: 'strong', entryType: 'idea', locationName: 'Eilenriede' })])

    // Act
    const { container } = await renderDetail()

    // Assert
    expect(await screen.findByText('♥ 3')).toBeInTheDocument()
    expect(screen.queryByText(en.likesLabel)).not.toBeInTheDocument()
    expect(container.textContent).not.toMatch(/Eilenriede|strong|idea/i)
  })

  it('shows no like count for an entry without likes', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'q-1', text: 'Ohne Likes', likes: 0 })])

    // Act
    await renderDetail()

    // Assert
    expect(screen.queryByText(/♥/)).not.toBeInTheDocument()
  })

  it('labels a resting entry with the rest status', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'q-1', status: 'rest' })])

    // Act
    await renderDetail()

    // Assert
    const metric = screen.getAllByText(en.entryStatus).find((node) => node.tagName === 'P')?.parentElement as HTMLElement
    expect(within(metric).getByText(en.entryStatus_rest)).toBeInTheDocument()
  })

  it('shows the description label for the note', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'q-1', note: 'Eine Beschreibung' })])

    // Act
    await renderDetail()

    // Assert
    expect(screen.getAllByText(en.note).length).toBeGreaterThan(0)
    expect(en.note).toBe('Description')
  })

  describe('thoughts', () => {
    it('lists the thoughts of the entry', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1', thoughts: [thought] })])

      // Act
      await renderDetail()

      // Assert
      expect(screen.getByRole('heading', { name: en.thoughtsTitle })).toBeInTheDocument()
      expect(screen.getByLabelText(en.editThought)).toHaveValue('Erster Gedanke')
    })

    it('adds a thought through the sheet', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1' })])
      await renderDetail()

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.addThought }))
      fireEvent.change(screen.getByPlaceholderText(en.thoughtPlaceholder), { target: { value: 'Neuer Gedanke' } })
      fireEvent.click(screen.getByRole('button', { name: en.save }))

      // Assert
      await waitFor(async () => expect((await getQuote('q-1'))?.thoughts?.map((item) => item.text)).toEqual(['Neuer Gedanke']), SLOW)
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('edits a thought on blur', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1', thoughts: [thought] })])
      await renderDetail()

      // Act
      const input = screen.getByLabelText(en.editThought)
      fireEvent.change(input, { target: { value: 'Geänderter Gedanke' } })
      fireEvent.blur(input)

      // Assert
      await waitFor(async () => expect((await getQuote('q-1'))?.thoughts?.[0].text).toBe('Geänderter Gedanke'), SLOW)
    })

    it('removes a thought', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1', thoughts: [thought] })])
      await renderDetail()

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.removeThought }))

      // Assert
      await waitFor(async () => expect((await getQuote('q-1'))?.thoughts).toEqual([]), SLOW)
    })

    it('offers undo after removing a thought and restores it unchanged', async () => {
      // Arrange
      const fromNote: Thought = { ...thought, fromNote: true }
      await upsertQuotes([makeQuote({ id: 'q-1', thoughts: [fromNote] })])
      await renderDetail()
      fireEvent.click(screen.getByRole('button', { name: en.removeThought }))
      await waitFor(async () => expect((await getQuote('q-1'))?.thoughts).toEqual([]), SLOW)
      expect(useToastStore.getState().toast).toMatchObject({ message: en.thoughtDeleted, actionLabel: en.undo })

      // Act
      await act(async () => {
        useToastStore.getState().toast?.onAction?.()
      })

      // Assert
      await waitFor(async () => expect((await getQuote('q-1'))?.thoughts).toEqual([fromNote]), SLOW)
    })
  })

  describe('adopting the description as a thought', () => {
    it.each([
      ['has no description', { text: 'Text' }],
      ['has no text', { text: '', note: 'Beschreibung' }]
    ])('is hidden when the entry %s', async (_name, overrides) => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1', audioDataUrl: 'data:audio/webm;base64,AA==', ...overrides })])

      // Act
      await renderDetail()

      // Assert
      expect(screen.queryByRole('button', { name: en.adoptNote })).not.toBeInTheDocument()
    })

    it('moves the description into a thought and restores it with undo', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1', text: 'Text', note: 'Meine Beschreibung', thoughts: [thought] })])
      await renderDetail()

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.adoptNote }))

      // Assert
      await waitFor(async () => {
        const stored = await getQuote('q-1')
        expect(stored?.note).toBeFalsy()
        expect(stored?.thoughts?.map((item) => item.text)).toContain('Meine Beschreibung')
      }, SLOW)
      expect(useToastStore.getState().toast?.message).toBe(en.adoptNoteToast)

      // Act
      await act(async () => {
        useToastStore.getState().toast?.onAction?.()
      })

      // Assert
      await waitFor(async () => {
        const stored = await getQuote('q-1')
        expect(stored?.note).toBe('Meine Beschreibung')
        expect(stored?.thoughts).toEqual([thought])
      }, SLOW)
    })
  })

  it('keeps a thought added after adopting the description when the adoption is undone', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'q-1', text: 'Text', note: 'Meine Beschreibung', thoughts: [thought] })])
    await renderDetail()
    fireEvent.click(screen.getByRole('button', { name: en.adoptNote }))
    await waitFor(async () => expect((await getQuote('q-1'))?.note).toBeFalsy(), SLOW)
    const undo = useToastStore.getState().toast?.onAction
    await act(async () => {
      await useQuoteStore.getState().addThought('q-1', 'Später dazu')
    })

    // Act
    await act(async () => {
      undo?.()
    })

    // Assert
    await waitFor(async () => expect((await getQuote('q-1'))?.note).toBe('Meine Beschreibung'), SLOW)
    const texts = (await getQuote('q-1'))?.thoughts?.map((item) => item.text)
    expect(texts).toEqual([thought.text, 'Später dazu'])
  })

  it('wakes a resting entry', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'q-1', status: 'rest' })])
    await renderDetail()

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.wake }))

    // Assert
    await waitFor(async () => {
      const stored = await getQuote('q-1')
      expect(stored?.status).toBe('signal')
      expect(stored?.reviewIntervalDays).toBe(1)
    }, SLOW)
  })

  it('does not offer waking for a signal', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'q-1' })])

    // Act
    await renderDetail()

    // Assert
    expect(screen.queryByRole('button', { name: en.wake })).not.toBeInTheDocument()
  })

  describe('status editing', () => {
    it('offers noise, signal and rest', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1' })])

      // Act
      await renderDetail()

      // Assert
      const select = screen.getByLabelText(en.entryStatus)
      expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual([
        en.entryStatus_inbox,
        en.entryStatus_signal,
        en.entryStatus_rest
      ])
    })

    it('starts the interval at 1 when saving noise as a signal', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1', status: 'inbox' })])
      await renderDetail()

      // Act
      fireEvent.change(screen.getByLabelText(en.entryStatus), { target: { value: 'signal' } })
      fireEvent.click(screen.getByRole('button', { name: en.saveChanges }))

      // Assert
      await waitFor(async () => {
        const stored = await getQuote('q-1')
        expect(stored?.status).toBe('signal')
        expect(stored?.reviewIntervalDays).toBe(1)
        expect(stored?.nextReviewAt).toBeTruthy()
      }, SLOW)
    })

    it('leaves the interval untouched when saving a signal again', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1', reviewIntervalDays: 14, nextReviewAt: '2026-03-01T05:00:00.000Z' })])
      await renderDetail()

      // Act
      fireEvent.change(screen.getByLabelText(en.text), { target: { value: 'Neuer Text' } })
      fireEvent.click(screen.getByRole('button', { name: en.saveChanges }))

      // Assert
      await waitFor(async () => expect((await getQuote('q-1'))?.text).toBe('Neuer Text'), SLOW)
      const stored = await getQuote('q-1')
      expect(stored?.reviewIntervalDays).toBe(14)
      expect(stored?.nextReviewAt).toBe('2026-03-01T05:00:00.000Z')
    })

    it('keeps the thoughts when the status changes', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1', thoughts: [thought] })])
      await renderDetail()

      // Act
      fireEvent.change(screen.getByLabelText(en.entryStatus), { target: { value: 'rest' } })
      fireEvent.click(screen.getByRole('button', { name: en.saveChanges }))

      // Assert
      await waitFor(async () => expect((await getQuote('q-1'))?.status).toBe('rest'), SLOW)
      expect((await getQuote('q-1'))?.thoughts).toEqual([thought])
    })
  })

  describe('saving the edit form after changes made elsewhere on the page', () => {
    async function saveTags(value: string) {
      fireEvent.change(screen.getByLabelText(en.tags), { target: { value } })
      fireEvent.click(screen.getByRole('button', { name: en.saveChanges }))
      await waitFor(async () => expect((await getQuote('q-1'))?.tags).toEqual([value]), SLOW)
    }

    it('keeps a woken entry awake when only a tag is edited afterwards', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1', status: 'rest', tags: ['alt'] })])
      await renderDetail()
      fireEvent.click(screen.getByRole('button', { name: en.wake }))
      await waitFor(async () => expect((await getQuote('q-1'))?.status).toBe('signal'), SLOW)

      // Act
      await saveTags('neu')

      // Assert
      const stored = await getQuote('q-1')
      expect(stored?.status).toBe('signal')
      expect(stored?.reviewIntervalDays).toBe(1)
    })

    it('keeps the note empty after adopting it when only a tag is edited afterwards', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1', text: 'Text', note: 'Meine Beschreibung', tags: ['alt'] })])
      await renderDetail()
      fireEvent.click(screen.getByRole('button', { name: en.adoptNote }))
      await waitFor(async () => expect((await getQuote('q-1'))?.note).toBeFalsy(), SLOW)

      // Act
      await saveTags('neu')

      // Assert
      const stored = await getQuote('q-1')
      expect(stored?.note).toBeFalsy()
      expect(stored?.thoughts?.map((item) => item.text)).toEqual(['Meine Beschreibung'])
    })

    it('keeps the favorite toggled on the page when the form is saved afterwards', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1', tags: ['alt'] })])
      await renderDetail()
      fireEvent.click(screen.getByRole('button', { name: en.favorite }))
      await waitFor(async () => expect((await getQuote('q-1'))?.favorite).toBe(true), SLOW)

      // Act
      await saveTags('neu')

      // Assert
      expect((await getQuote('q-1'))?.favorite).toBe(true)
    })

    it('keeps an unsaved description when the favorite is toggled on the page', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1', note: 'Alt' })])
      await renderDetail()
      fireEvent.change(screen.getByLabelText(en.note), { target: { value: 'Neu getippt' } })

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.favorite }))
      await waitFor(async () => expect((await getQuote('q-1'))?.favorite).toBe(true), SLOW)

      // Assert
      expect(screen.getByLabelText(en.note)).toHaveValue('Neu getippt')
    })

    it('empties an untouched description field when the note is adopted as a thought', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1', text: 'Text', note: 'Meine Beschreibung' })])
      await renderDetail()
      expect(screen.getByLabelText(en.note)).toHaveValue('Meine Beschreibung')

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.adoptNote }))

      // Assert
      await waitFor(() => expect(screen.getByLabelText(en.note)).toHaveValue(''), SLOW)
    })

    it('keeps an unsaved status choice when the entry is woken on the page', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1', status: 'rest' })])
      await renderDetail()
      fireEvent.change(screen.getByLabelText(en.entryStatus), { target: { value: 'inbox' } })

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.wake }))
      await waitFor(async () => expect((await getQuote('q-1'))?.status).toBe('signal'), SLOW)

      // Assert
      expect(screen.getByLabelText(en.entryStatus)).toHaveValue('inbox')
    })

    it('starts a rest entry saved as signal at interval 1 for tomorrow 06:00', async () => {
      // Arrange
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-03-10T12:00:00'))
      await upsertQuotes([makeQuote({ id: 'q-1', status: 'rest' })])
      await renderDetail()

      // Act
      fireEvent.change(screen.getByLabelText(en.entryStatus), { target: { value: 'signal' } })
      fireEvent.click(screen.getByRole('button', { name: en.saveChanges }))

      // Assert
      await waitFor(async () => expect((await getQuote('q-1'))?.status).toBe('signal'), SLOW)
      const stored = await getQuote('q-1')
      expect(stored?.reviewIntervalDays).toBe(1)
      expect(stored?.nextReviewAt).toBe(reviewDateFromInterval(1, new Date('2026-03-10T12:00:00')))
      expect(new Date(stored?.nextReviewAt as string).getHours()).toBe(6)
    })
  })
})
