import { create } from 'zustand'
import {
  clearQuotes,
  createQuote,
  deleteQuote,
  emptyTrash as emptyTrashDb,
  listQuotes,
  updateQuote,
  upsertQuotes
} from '../db/database'
import { applyReview, nextMorningISO, type ReviewAction } from '../services/review'
import { tapHaptic } from '../services/haptics'
import type { Quote, QuoteFilters, QuoteInput } from '../types/quote'
import { emptyFilters } from '../services/search'

interface QuoteStore {
  quotes: Quote[]
  filters: QuoteFilters
  loading: boolean
  loadQuotes: () => Promise<void>
  addQuote: (input: QuoteInput) => Promise<Quote>
  saveQuote: (id: string, patch: Partial<Quote>) => Promise<void>
  likeQuote: (id: string) => Promise<void>
  dislikeQuote: (id: string) => Promise<void>
  removeQuote: (id: string) => Promise<void>
  snoozeQuote: (id: string) => Promise<void>
  discardQuote: (id: string) => Promise<void>
  restoreQuote: (id: string) => Promise<void>
  emptyTrash: () => Promise<void>
  unlinkBook: (bookId: string) => Promise<void>
  syncBookReferences: (
    bookId: string,
    nextBook: { title: string; author?: string },
    previousBook?: { title: string; author?: string }
  ) => Promise<void>
  reviewQuote: (id: string, action: ReviewAction) => Promise<void>
  importQuotes: (quotes: Quote[]) => Promise<void>
  clearAll: () => Promise<void>
  setFilters: (patch: Partial<QuoteFilters>) => void
  resetFilters: () => void
}

export const useQuoteStore = create<QuoteStore>((set, get) => ({
  quotes: [],
  filters: emptyFilters,
  loading: true,
  loadQuotes: async () => {
    set({ loading: true })
    set({ quotes: await listQuotes(), loading: false })
  },
  addQuote: async (input) => {
    const quote = await createQuote(input)
    await get().loadQuotes()
    return quote
  },
  saveQuote: async (id, patch) => {
    await updateQuote(id, patch)
    await get().loadQuotes()
  },
  likeQuote: async (id) => {
    const quote = get().quotes.find((item) => item.id === id)
    if (!quote) return
    const next = (quote.likes ?? 0) + 1
    // Optimistic bump so the count animates instantly, then persist.
    set((state) => ({
      quotes: state.quotes.map((item) => (item.id === id ? { ...item, likes: next } : item))
    }))
    tapHaptic(8)
    await updateQuote(id, { likes: next })
  },
  dislikeQuote: async (id) => {
    const quote = get().quotes.find((item) => item.id === id)
    if (!quote) return
    const next = Math.max(0, (quote.likes ?? 0) - 1)
    if (next === (quote.likes ?? 0)) return
    set((state) => ({
      quotes: state.quotes.map((item) => (item.id === id ? { ...item, likes: next } : item))
    }))
    tapHaptic(12)
    await updateQuote(id, { likes: next })
  },
  removeQuote: async (id) => {
    await deleteQuote(id)
    await get().loadQuotes()
  },
  snoozeQuote: async (id) => {
    await updateQuote(id, { snoozedUntil: nextMorningISO() })
    await get().loadQuotes()
  },
  discardQuote: async (id) => {
    await updateQuote(id, { deletedAt: new Date().toISOString() })
    await get().loadQuotes()
  },
  restoreQuote: async (id) => {
    await updateQuote(id, { deletedAt: undefined })
    await get().loadQuotes()
  },
  emptyTrash: async () => {
    await emptyTrashDb()
    await get().loadQuotes()
  },
  unlinkBook: async (bookId) => {
    const affected = get().quotes.filter((quote) => quote.bookId === bookId)
    await Promise.all(affected.map((quote) => updateQuote(quote.id, { bookId: undefined })))
    if (affected.length) await get().loadQuotes()
  },
  syncBookReferences: async (bookId, nextBook, previousBook) => {
    const affected = get().quotes.filter((quote) => quote.bookId === bookId)
    if (!affected.length) return

    await Promise.all(
      affected.map((quote) => {
        const patch: Partial<Quote> = {
          work: nextBook.title
        }

        if (previousBook && previousBook.author !== nextBook.author) {
          patch.author = nextBook.author
        }

        const sourceWasBookTitle =
          !quote.source ||
          quote.source === previousBook?.title ||
          quote.source === quote.work

        if (sourceWasBookTitle) {
          patch.source = nextBook.title
        }

        return updateQuote(quote.id, patch)
      })
    )
    await get().loadQuotes()
  },
  reviewQuote: async (id, action) => {
    const quote = get().quotes.find((item) => item.id === id)
    if (!quote) return
    await updateQuote(id, applyReview(quote, action))
    await get().loadQuotes()
  },
  importQuotes: async (quotes) => {
    await upsertQuotes(quotes)
    await get().loadQuotes()
  },
  clearAll: async () => {
    await clearQuotes()
    await get().loadQuotes()
  },
  setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),
  resetFilters: () => set({ filters: emptyFilters })
}))
