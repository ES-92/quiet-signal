import { useEffect, useMemo, useRef, useState } from 'react'
import { buildReflection } from '../services/reflections'
import { selectDailyStack, type BookWeightMap } from '../services/review'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { quoteStatus, type Quote } from '../types/quote'

// Loads the library and owns the deck of this visit: stable card order, discarded cards and the current position.
export function useDailySession() {
  const { quotes, loading, loadQuotes } = useQuoteStore()
  const { books, loadBooks } = useBookStore()
  const { dailyCount, dailyMode } = useSettingsStore()
  const [index, setIndex] = useState(0)
  const [sessionQuoteIds, setSessionQuoteIds] = useState<string[]>([])
  // Discarded cards vanish from the deck at once, before the store has finished persisting and reloading.
  const [discardedIds, setDiscardedIds] = useState<string[]>([])

  // Original deck position of each hidden card, so undo can put it back after the reload dropped its id.
  const hiddenPositions = useRef(new Map<string, number>())

  useEffect(() => {
    void loadQuotes()
    void loadBooks()
  }, [loadQuotes, loadBooks])

  const bookWeights = useMemo<BookWeightMap>(
    () => Object.fromEntries(books.map((book) => [book.id, book.weight])),
    [books]
  )

  const selectedDailyQuotes = useMemo(
    () => selectDailyStack(quotes, { limit: dailyCount, mode: dailyMode, bookWeights }),
    [bookWeights, dailyCount, dailyMode, quotes]
  )

  // Keep the cards of this visit stable while the underlying selection changes (adjusting state while rendering, not in an effect).
  const [sessionSource, setSessionSource] = useState<{ quotes: Quote[]; selected: Quote[] }>()
  if (sessionSource?.quotes !== quotes || sessionSource?.selected !== selectedDailyQuotes) {
    setSessionSource({ quotes, selected: selectedDailyQuotes })
    const nextIds = nextSessionIds(sessionQuoteIds, quotes, selectedDailyQuotes)
    if (nextIds !== sessionQuoteIds) setSessionQuoteIds(nextIds)
  }

  const dailyQuotes = useMemo(() => {
    const quoteById = new Map(quotes.map((quote) => [quote.id, quote]))
    const stack =
      sessionQuoteIds.length === 0
        ? selectedDailyQuotes
        : sessionQuoteIds.map((id) => quoteById.get(id)).filter((quote) => quote !== undefined)
    return stack.filter((quote) => !discardedIds.includes(quote.id))
  }, [discardedIds, quotes, selectedDailyQuotes, sessionQuoteIds])
  const weeklyReflection = useMemo(() => buildReflection(quotes, books, 'week'), [books, quotes])
  const inboxCount = useMemo(
    () => quotes.filter((quote) => quoteStatus(quote) === 'inbox' && !quote.deletedAt).length,
    [quotes]
  )

  if (index > dailyQuotes.length) setIndex(dailyQuotes.length)

  const currentIndex = Math.min(index, dailyQuotes.length)
  const currentQuote = dailyQuotes[currentIndex]
  const currentBook = currentQuote?.bookId ? books.find((book) => book.id === currentQuote.bookId) : undefined

  return {
    loading,
    dailyQuotes,
    currentIndex,
    currentQuote,
    nextQuote: dailyQuotes[currentIndex + 1],
    thirdQuote: dailyQuotes[currentIndex + 2],
    currentBook,
    stackCompleted: dailyQuotes.length > 0 && !currentQuote,
    reflectionCount: weeklyReflection.entries.length,
    showReflectionNudge: weeklyReflection.entries.length >= 3,
    inboxCount,
    advanceIndex: () => setIndex((value) => Math.min(value + 1, dailyQuotes.length)),
    hideQuote: (id: string) => {
      const position = sessionQuoteIds.indexOf(id)
      if (position >= 0) hiddenPositions.current.set(id, position)
      setDiscardedIds((ids) => [...ids, id])
    },
    showQuote: (id: string) => {
      const position = hiddenPositions.current.get(id)
      hiddenPositions.current.delete(id)
      if (position !== undefined) {
        setSessionQuoteIds((ids) => (ids.includes(id) ? ids : [...ids.slice(0, position), id, ...ids.slice(position)]))
      }
      setDiscardedIds((ids) => ids.filter((item) => item !== id))
    }
  }
}

export function nextSessionIds(currentIds: string[], quotes: Quote[], selectedQuotes: Quote[]) {
  const selectedIds = selectedQuotes.map((quote) => quote.id)
  const existingIds = new Set(quotes.map((quote) => quote.id))
  if (selectedIds.length === 0) {
    const retainedIds = currentIds.filter((id) => existingIds.has(id))
    return sameIds(retainedIds, currentIds) ? currentIds : retainedIds
  }
  if (currentIds.length === 0) return selectedIds
  const retainedIds = currentIds.filter((id) => existingIds.has(id))
  if (retainedIds.length === 0) return selectedIds
  return sameIds(retainedIds, currentIds) ? currentIds : retainedIds
}

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index])
}
