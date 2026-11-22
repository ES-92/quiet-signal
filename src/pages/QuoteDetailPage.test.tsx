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

async function renderDetail(id = 'q-1', { editing = false } = {}) {
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
  await screen.findByRole('button', { name: en.edit })
  if (editing) fireEvent.click(screen.getByRole('button', { name: en.edit }))
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
  describe('info line', () => {
    const now = new Date('2026-03-10T12:00:00')

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(now)
    })

    afterEach(() => {
      localStorage.removeItem('quiet-signal-language')
    })

    it('tells a signal when it comes back, how often it was met and its likes, without date year this year', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1', reviewCount: 6, likes: 12, nextReviewAt: '2026-12-04T05:00:00.000Z' })])

      // Act
      await renderDetail()

      // Assert
      expect(screen.getByText('Comes back on December 4 · Seen 6 times · 12 likes')).toBeInTheDocument()
    })

    it('writes the date in the app language', async () => {
      // Arrange
      localStorage.setItem('quiet-signal-language', 'de')
      await upsertQuotes([makeQuote({ id: 'q-1', reviewCount: 6, likes: 12, nextReviewAt: '2026-12-04T05:00:00.000Z' })])
      renderWithProviders(
        <Routes>
          <Route path="/quote/:id" element={<QuoteDetailPage />} />
        </Routes>,
        { route: '/quote/q-1' }
      )

      // Act
      const line = await screen.findByText(/Kommt am/)

      // Assert
      expect(line).toHaveTextContent('Kommt am 4. Dezember wieder · 6× begegnet · 12 Likes')
    })

    it('adds the year when the date lies in another year', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1', reviewCount: 2, nextReviewAt: '2027-01-15T05:00:00.000Z' })])

      // Act
      await renderDetail()

      // Assert
      expect(screen.getByText('Comes back on January 15, 2027 · Seen 2 times')).toBeInTheDocument()
    })

    it('uses the singular for one encounter and omits likes when there are none', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1', reviewCount: 1, likes: 0, nextReviewAt: '2026-04-01T05:00:00.000Z' })])

      // Act
      await renderDetail()

      // Assert
      expect(screen.getByText('Comes back on April 1 · Seen 1 time')).toBeInTheDocument()
      expect(screen.queryByText(/like/i)).not.toBeInTheDocument()
    })

    it('omits the encounter count for a signal that was never reviewed', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1', reviewCount: 0, nextReviewAt: '2026-04-01T05:00:00.000Z' })])

      // Act
      await renderDetail()

      // Assert
      expect(screen.getByText('Comes back on April 1')).toBeInTheDocument()
    })

    it.each([
      ['due earlier today', { nextReviewAt: '2026-03-10T05:00:00.000Z' }],
      ['due later today', { nextReviewAt: '2026-03-10T20:00:00.000Z' }],
      ['without a due date', { nextReviewAt: undefined }]
    ])('says due today for a signal that is %s', async (_name, overrides) => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1', reviewCount: 3, likes: 2, ...overrides })])

      // Act
      await renderDetail()

      // Assert
      expect(screen.getByText('Due today · Seen 3 times · 2 likes')).toBeInTheDocument()
    })

    it('uses the capped due date of a favourite, not the stored one', async () => {
      // Arrange
      await upsertQuotes([
        makeQuote({
          id: 'q-1',
          favorite: true,
          reviewCount: 4,
          lastReviewedAt: '2026-03-01T09:00:00.000Z',
          nextReviewAt: '2026-09-01T05:00:00.000Z'
        })
      ])

      // Act
      await renderDetail()

      // Assert
      expect(screen.getByText('Comes back on March 31 · Seen 4 times')).toBeInTheDocument()
    })

    it('uses the singular for one like and never shows a heart glyph', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1', reviewCount: 0, likes: 1, nextReviewAt: '2026-04-01T05:00:00.000Z' })])

      // Act
      await renderDetail()

      // Assert
      expect(screen.getByText('Comes back on April 1 · 1 like')).toBeInTheDocument()
      expect(screen.queryByText(/♥/)).not.toBeInTheDocument()
    })

    it('shows a resting entry as resting with its encounters and likes, without a date', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1', status: 'rest', reviewCount: 6, likes: 5, nextReviewAt: '2026-12-04T05:00:00.000Z' })])

      // Act
      await renderDetail()

      // Assert
      expect(screen.getByText('Resting · Seen 6 times · 5 likes')).toBeInTheDocument()
    })

    it('shows noise as not yet sorted', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1', status: 'inbox', reviewCount: 0 })])

      // Act
      await renderDetail()

      // Assert
      expect(screen.getByText('Not sorted yet')).toBeInTheDocument()
    })

    it('replaces the stat tiles', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1', likes: 3 })])

      // Act
      await renderDetail()

      // Assert
      expect(screen.queryByText(en.entryStatus)).not.toBeInTheDocument()
      expect(screen.queryByText('♥ 3')).not.toBeInTheDocument()
    })
  })

  it('says how long a signal has been overdue', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-03-10T12:00:00'))
    await upsertQuotes([makeQuote({ id: 'q-1', reviewCount: 3, nextReviewAt: '2026-03-07T05:00:00.000Z' })])

    // Act
    await renderDetail()

    // Assert
    expect(screen.getByText('Overdue for 3 days · Seen 3 times')).toBeInTheDocument()
  })

  describe('edit form', () => {
    it('stays hidden until Edit is pressed', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1', text: 'Zitat' })])
      await renderDetail()
      expect(screen.queryByLabelText(en.text)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: en.edit })).toHaveAttribute('aria-expanded', 'false')

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.edit }))

      // Assert
      expect(screen.getByLabelText(en.text)).toHaveValue('Zitat')
      expect(screen.getByRole('button', { name: en.edit })).toHaveAttribute('aria-expanded', 'true')
    })

    it('collapses again after a successful save', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1' })])
      await renderDetail('q-1', { editing: true })
      fireEvent.change(screen.getByLabelText(en.tags), { target: { value: 'neu' } })

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.saveChanges }))

      // Assert
      await waitFor(async () => expect((await getQuote('q-1'))?.tags).toEqual(['neu']), SLOW)
      await waitFor(() => expect(screen.queryByLabelText(en.tags)).not.toBeInTheDocument(), SLOW)
    })

    it('stays open with its values when saving fails', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1' })])
      await renderDetail('q-1', { editing: true })
      const originalSave = useQuoteStore.getState().saveQuote
      useQuoteStore.setState({ saveQuote: vi.fn().mockRejectedValue(new Error('boom')) })
      fireEvent.change(screen.getByLabelText(en.tags), { target: { value: 'neu' } })

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.saveChanges }))

      // Assert
      await waitFor(() => expect(useToastStore.getState().toast?.message).toBe(en.saveFailed), SLOW)
      useQuoteStore.setState({ saveQuote: originalSave })
      expect(screen.getByLabelText(en.tags)).toHaveValue('neu')
    })

    it('collapses without saving when Edit is pressed again', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1' })])
      await renderDetail('q-1', { editing: true })

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.edit }))

      // Assert
      expect(screen.queryByLabelText(en.text)).not.toBeInTheDocument()
    })
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
      await renderDetail('q-1', { editing: true })

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
      await renderDetail('q-1', { editing: true })

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
      await renderDetail('q-1', { editing: true })

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
      await renderDetail('q-1', { editing: true })

      // Act
      fireEvent.change(screen.getByLabelText(en.entryStatus), { target: { value: 'rest' } })
      fireEvent.click(screen.getByRole('button', { name: en.saveChanges }))

      // Assert
      await waitFor(async () => expect((await getQuote('q-1'))?.status).toBe('rest'), SLOW)
      expect((await getQuote('q-1'))?.thoughts).toEqual([thought])
    })
  })

  describe('opening the edit form after changes made elsewhere on the page', () => {
    // Spies on the store's saveQuote so the patch the form sends can be inspected next to the stored result.
    function spyOnSave() {
      const original = useQuoteStore.getState().saveQuote
      const spy = vi.fn(original)
      useQuoteStore.setState({ saveQuote: spy })
      return { spy, restore: () => useQuoteStore.setState({ saveQuote: original }) }
    }

    async function openAndSaveTag(value: string) {
      fireEvent.click(screen.getByRole('button', { name: en.edit }))
      fireEvent.change(screen.getByLabelText(en.tags), { target: { value } })
      fireEvent.click(screen.getByRole('button', { name: en.saveChanges }))
      await waitFor(async () => expect((await getQuote('q-1'))?.tags).toEqual([value]), SLOW)
    }

    it('sends no status when the form is opened after waking and only a tag is saved', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1', status: 'rest', tags: ['alt'] })])
      await renderDetail()
      fireEvent.click(screen.getByRole('button', { name: en.wake }))
      await waitFor(async () => expect((await getQuote('q-1'))?.status).toBe('signal'), SLOW)
      const { spy, restore } = spyOnSave()

      // Act
      await openAndSaveTag('neu')

      // Assert
      restore()
      const patch = spy.mock.calls[0][1]
      expect(patch).not.toHaveProperty('status')
      expect(patch).not.toHaveProperty('favorite')
      expect(patch).not.toHaveProperty('note')
      expect(patch).not.toHaveProperty('reviewIntervalDays')
      const stored = await getQuote('q-1')
      expect(stored?.status).toBe('signal')
      expect(stored?.reviewIntervalDays).toBe(1)
    })

    it('leaves the favourite as toggled when the form is opened afterwards and only a tag is saved', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1', tags: ['alt'] })])
      await renderDetail()
      fireEvent.click(screen.getByRole('button', { name: en.favorite }))
      await waitFor(async () => expect((await getQuote('q-1'))?.favorite).toBe(true), SLOW)
      const { spy, restore } = spyOnSave()

      // Act
      await openAndSaveTag('neu')

      // Assert
      restore()
      expect(spy.mock.calls[0][1]).not.toHaveProperty('favorite')
      expect((await getQuote('q-1'))?.favorite).toBe(true)
    })

    it('keeps the note empty when the form is opened after adopting it and only a tag is saved', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1', text: 'Text', note: 'Meine Beschreibung', tags: ['alt'] })])
      await renderDetail()
      fireEvent.click(screen.getByRole('button', { name: en.adoptNote }))
      await waitFor(async () => expect((await getQuote('q-1'))?.note).toBeFalsy(), SLOW)
      const { spy, restore } = spyOnSave()

      // Act
      await openAndSaveTag('neu')

      // Assert
      restore()
      expect(spy.mock.calls[0][1]).not.toHaveProperty('note')
      const stored = await getQuote('q-1')
      expect(stored?.note).toBeFalsy()
      expect(stored?.thoughts?.map((item) => item.text)).toEqual(['Meine Beschreibung'])
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
      await renderDetail('q-1', { editing: true })
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
      await renderDetail('q-1', { editing: true })
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
      await renderDetail('q-1', { editing: true })
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
      await renderDetail('q-1', { editing: true })
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
      await renderDetail('q-1', { editing: true })
      expect(screen.getByLabelText(en.note)).toHaveValue('Meine Beschreibung')

      // Act
      fireEvent.click(screen.getByRole('button', { name: en.adoptNote }))

      // Assert
      await waitFor(() => expect(screen.getByLabelText(en.note)).toHaveValue(''), SLOW)
    })

    it('keeps an unsaved status choice when the entry is woken on the page', async () => {
      // Arrange
      await upsertQuotes([makeQuote({ id: 'q-1', status: 'rest' })])
      await renderDetail('q-1', { editing: true })
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
      await renderDetail('q-1', { editing: true })

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
