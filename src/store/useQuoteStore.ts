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
import {
  lessOftenPatch,
  moreOftenPatch,
  restoreReviewPatch,
  restPatch,
  undoRestPatch,
  favoriteCapPatch,
  favoriteTogglePatch,
  reviewSnapshot,
  wakePatch,
  type ReviewSnapshot
} from '../services/lifecycle'
import { nextMorningISO } from '../services/review'
import {
  addThoughtPatch,
  adoptNotePatch,
  editThoughtPatch,
  removeThoughtPatch,
  restoreThoughtPatch,
  undoAdoptNotePatch
} from '../services/thoughts'
import { tapHaptic } from '../services/haptics'
import type { Quote, QuoteFilters, QuoteInput, Thought } from '../types/quote'
import { emptyFilters } from '../services/search'

interface QuoteStore {
  quotes: Quote[]
  filters: QuoteFilters
  loading: boolean
  // Wall-clock time of the last load; lets pages derive time-dependent views (e.g. snooze expiry) without reading the clock while rendering.
  loadedAt: number
  loadQuotes: () => Promise<void>
  addQuote: (input: QuoteInput) => Promise<Quote>
  saveQuote: (id: string, patch: Partial<Quote>) => Promise<void>
  likeQuote: (id: string) => Promise<void>
  toggleFavorite: (id: string) => Promise<void>
  removeQuote: (id: string) => Promise<void>
  snoozeQuote: (id: string) => Promise<void>
  // onPrevious receives the review values of the row the change was actually applied to (for an undo).
  moreOften: (id: string, onPrevious?: (previous: ReviewSnapshot) => void) => Promise<number | undefined>
  lessOften: (id: string, onPrevious?: (previous: ReviewSnapshot) => void) => Promise<number | undefined>
  restoreReview: (id: string, previous: ReviewSnapshot) => Promise<void>
  restQuote: (id: string) => Promise<void>
  // Undo of restQuote: back to signal with the previous snooze, and the rest event leaves the activity log.
  undoRest: (id: string, previousSnooze: string | undefined) => Promise<void>
  wakeQuote: (id: string) => Promise<void>
  addThought: (id: string, text: string) => Promise<void>
  editThought: (id: string, thoughtId: string, text: string) => Promise<void>
  removeThought: (id: string, thoughtId: string) => Promise<void>
  restoreThought: (id: string, thought: Thought) => Promise<void>
  // Resolves with the id of the thought created from the note (undefined when there was nothing to adopt).
  adoptNote: (id: string) => Promise<string | undefined>
  undoAdoptNote: (id: string, thoughtId: string, note: string | undefined) => Promise<void>
  discardQuote: (id: string) => Promise<void>
  restoreQuote: (id: string) => Promise<void>
  emptyTrash: () => Promise<void>
  unlinkBook: (bookId: string) => Promise<void>
  syncBookReferences: (
    bookId: string,
    nextBook: { title: string; author?: string },
    previousBook?: { title: string; author?: string }
  ) => Promise<void>
  importQuotes: (quotes: Quote[]) => Promise<void>
  clearAll: () => Promise<void>
  setFilters: (patch: Partial<QuoteFilters>) => void
  resetFilters: () => void
}

export const useQuoteStore = create<QuoteStore>((set, get) => ({
  quotes: [],
  filters: emptyFilters,
  loading: true,
  loadedAt: Date.now(),
  // `loading` stays true only until the first load has finished. Every action reloads afterwards, and flagging those reloads
  // as loading would swap the deck for the loading placeholder and back, remounting it under the user's hands.
  loadQuotes: async () => {
    set({ quotes: await listQuotes(), loading: false, loadedAt: Date.now() })
  },
  addQuote: async (input) => {
    const quote = await createQuote(input)
    await get().loadQuotes()
    return quote
  },
  saveQuote: async (id, patch) => {
    // Setting the favourite flag through any form (e.g. the edit form) also applies the 30-day cap.
    await updateQuote(id, patch.favorite ? (current) => (current.favorite ? patch : { ...favoriteCapPatch(current), ...patch }) : patch)
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
  toggleFavorite: async (id) => {
    if (!get().quotes.some((item) => item.id === id)) return
    await updateQuote(id, (current) => favoriteTogglePatch(current))
    await get().loadQuotes()
  },
  removeQuote: async (id) => {
    await deleteQuote(id)
    await get().loadQuotes()
  },
  snoozeQuote: async (id) => {
    await updateQuote(id, { snoozedUntil: nextMorningISO() })
    await get().loadQuotes()
  },
  moreOften: async (id, onPrevious) => {
    if (!get().quotes.some((item) => item.id === id)) return undefined
    const updated = await updateQuote(id, (current) => {
      onPrevious?.(reviewSnapshot(current))
      return moreOftenPatch(current)
    })
    await get().loadQuotes()
    return updated?.reviewIntervalDays
  },
  lessOften: async (id, onPrevious) => {
    if (!get().quotes.some((item) => item.id === id)) return undefined
    const updated = await updateQuote(id, (current) => {
      onPrevious?.(reviewSnapshot(current))
      return lessOftenPatch(current)
    })
    await get().loadQuotes()
    return updated?.reviewIntervalDays
  },
  restoreReview: async (id, previous) => {
    if (!get().quotes.some((item) => item.id === id)) return
    await updateQuote(id, (current) => restoreReviewPatch(current, previous))
    await get().loadQuotes()
  },
  restQuote: async (id) => {
    if (!get().quotes.some((item) => item.id === id)) return
    await updateQuote(id, (current) => restPatch(current))
    await get().loadQuotes()
  },
  undoRest: async (id, previousSnooze) => {
    if (!get().quotes.some((item) => item.id === id)) return
    await updateQuote(id, (current) => undoRestPatch(current, previousSnooze))
    await get().loadQuotes()
  },
  wakeQuote: async (id) => {
    if (!get().quotes.some((item) => item.id === id)) return
    await updateQuote(id, (current) => wakePatch(current))
    await get().loadQuotes()
  },
  addThought: async (id, text) => {
    if (!get().quotes.some((item) => item.id === id)) return
    await updateQuote(id, (current) => addThoughtPatch(current, text))
    await get().loadQuotes()
  },
  editThought: async (id, thoughtId, text) => {
    if (!get().quotes.some((item) => item.id === id)) return
    await updateQuote(id, (current) => editThoughtPatch(current, thoughtId, text))
    await get().loadQuotes()
  },
  removeThought: async (id, thoughtId) => {
    if (!get().quotes.some((item) => item.id === id)) return
    await updateQuote(id, (current) => removeThoughtPatch(current, thoughtId))
    await get().loadQuotes()
  },
  restoreThought: async (id, thought) => {
    if (!get().quotes.some((item) => item.id === id)) return
    await updateQuote(id, (current) => restoreThoughtPatch(current, thought))
    await get().loadQuotes()
  },
  adoptNote: async (id) => {
    if (!get().quotes.some((item) => item.id === id)) return undefined
    let adoptedId: string | undefined
    await updateQuote(id, (current) => {
      const patch = adoptNotePatch(current)
      adoptedId = patch?.thoughts?.[patch.thoughts.length - 1]?.id
      return patch
    })
    await get().loadQuotes()
    return adoptedId
  },
  undoAdoptNote: async (id, thoughtId, note) => {
    if (!get().quotes.some((item) => item.id === id)) return
    await updateQuote(id, (current) => undoAdoptNotePatch(current, thoughtId, note))
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
