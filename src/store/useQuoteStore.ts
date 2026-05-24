import { create } from 'zustand'
import {
  clearQuotes,
  createQuote,
  deleteQuote,
  listQuotes,
  updateQuote,
  upsertQuotes
} from '../db/database'
import { applyReview, type ReviewAction } from '../services/review'
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
  removeQuote: (id: string) => Promise<void>
  unlinkBook: (bookId: string) => Promise<void>
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
    // Optimistic bump so the heart count animates instantly, then persist.
    set((state) => ({
      quotes: state.quotes.map((item) => (item.id === id ? { ...item, likes: (item.likes ?? 0) + 1 } : item))
    }))
    await updateQuote(id, { likes: (quote.likes ?? 0) + 1 })
  },
  removeQuote: async (id) => {
    await deleteQuote(id)
    await get().loadQuotes()
  },
  unlinkBook: async (bookId) => {
    const affected = get().quotes.filter((quote) => quote.bookId === bookId)
    await Promise.all(affected.map((quote) => updateQuote(quote.id, { bookId: undefined })))
    if (affected.length) await get().loadQuotes()
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
