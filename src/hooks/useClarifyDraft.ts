import { useState } from 'react'
import type { Book } from '../types/book'
import { statusChangePatch } from '../services/lifecycle'
import { quoteStatus, type Quote, type QuoteStatus } from '../types/quote'
import { clean, fromLocalDateTime, splitList, toLocalDateTime } from '../utils/draftFields'

export interface ClarifyDraft {
  text: string
  tags: string
  note: string
  firstThought: string
  author: string
  work: string
  source: string
  year: string
  bookId: string
  occurredAt: string
  people: string
}

const emptyDraft: ClarifyDraft = {
  text: '',
  tags: '',
  note: '',
  firstThought: '',
  author: '',
  work: '',
  source: '',
  year: '',
  bookId: '',
  occurredAt: '',
  people: ''
}

function draftFromQuote(quote: Quote): ClarifyDraft {
  return {
    text: quote.text ?? '',
    tags: quote.tags.join(', '),
    note: quote.note ?? '',
    firstThought: '',
    author: quote.author ?? '',
    work: quote.work ?? '',
    source: quote.source ?? '',
    year: quote.year ?? '',
    bookId: quote.bookId ?? '',
    occurredAt: toLocalDateTime(quote.occurredAt),
    people: (quote.people ?? []).join(', ')
  }
}

// Editable copy of the top card: re-seeded whenever a different entry comes to the top, and turned into a patch on save.
export function useClarifyDraft(quote: Quote | undefined, books: Book[]) {
  const [draft, setDraft] = useState<ClarifyDraft>(emptyDraft)
  const [detailsOpen, setDetailsOpen] = useState(false)

  // Re-seed the draft whenever a different entry comes to the top (adjusting state while rendering, not in an effect).
  const [seededQuoteId, setSeededQuoteId] = useState<string | undefined>()
  if (quote?.id !== seededQuoteId) {
    setSeededQuoteId(quote?.id)
    if (quote) {
      setDetailsOpen(false)
      setDraft(draftFromQuote(quote))
    }
  }

  function updateDraft(patch: Partial<ClarifyDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function changeBook(id: string) {
    const book = books.find((item) => item.id === id)
    setDraft((current) => ({
      ...current,
      bookId: id,
      ...(book ? { work: book.title, ...(book.author ? { author: book.author } : {}) } : {})
    }))
  }

  function buildPatch(status: QuoteStatus): Partial<Quote> {
    return {
      text: draft.text.trim(),
      tags: splitList(draft.tags).map((tag) => tag.toLowerCase()),
      note: clean(draft.note),
      status,
      author: clean(draft.author),
      work: clean(draft.work),
      source: clean(draft.source),
      year: clean(draft.year),
      bookId: clean(draft.bookId),
      occurredAt: fromLocalDateTime(draft.occurredAt),
      people: splitList(draft.people),
      ...statusChangePatch(quote ? quoteStatus(quote) : 'inbox', status)
    }
  }

  return { draft, updateDraft, changeBook, buildPatch, detailsOpen, setDetailsOpen }
}
