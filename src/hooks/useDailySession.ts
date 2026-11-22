import { useEffect, useMemo, useRef, useState } from 'react'
import { countThoughtsInPeriod } from '../services/reflections'
import { useToday } from './useToday'
import { selectBrowseStack, selectDailyStack } from '../services/review'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { dismissUndoToast } from '../store/useToastStore'
import { quoteStatus, type Quote } from '../types/quote'
import { localDateKey } from '../utils/date'

// Loads the library and owns the deck of this visit: stable card order, discarded cards and the current position.
export function useDailySession() {
  const { quotes, loading, loadQuotes } = useQuoteStore()
  const { loadBooks } = useBookStore()
  const { dailyCount } = useSettingsStore()
  const [index, setIndex] = useState(0)
  const [sessionQuoteIds, setSessionQuoteIds] = useState<string[]>([])
  // Discarded cards vanish from the deck at once, before the store has finished persisting and reloading.
  const [discardedIds, setDiscardedIds] = useState<string[]>([])
  // Browse mode: a fixed list of signals picked once per start, independent of due dates and reloads.
  const [browseIds, setBrowseIds] = useState<string[] | null>(null)
  const [browseRound, setBrowseRound] = useState(0)
  // Position in the daily deck while browsing, so "done" returns to where the visit was.
  const [dailyIndexBeforeBrowse, setDailyIndexBeforeBrowse] = useState(0)

  // Original deck position of each hidden card, so undo can put it back after the reload dropped its id.
  const hiddenPositions = useRef(new Map<string, number>())

  useEffect(() => {
    void loadQuotes()
    void loadBooks()
  }, [loadQuotes, loadBooks])

  const selectedDailyQuotes = useMemo(
    () => selectDailyStack(quotes, { limit: dailyCount }),
    [dailyCount, quotes]
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
    if (browseIds) {
      // Rested or removed cards drop out of the browse list; their ids stay so an undo puts them back in place.
      return browseIds
        .map((id) => quoteById.get(id))
        .filter((quote) => quote !== undefined)
        .filter((quote) => quoteStatus(quote) === 'signal' && !discardedIds.includes(quote.id))
    }
    const stack =
      sessionQuoteIds.length === 0
        ? selectedDailyQuotes
        : sessionQuoteIds.map((id) => quoteById.get(id)).filter((quote) => quote !== undefined)
    return stack.filter((quote) => !discardedIds.includes(quote.id))
  }, [browseIds, discardedIds, quotes, selectedDailyQuotes, sessionQuoteIds])
  const today = useToday()
  const weeklyThoughts = useMemo(() => countThoughtsInPeriod(quotes, 'week', today), [quotes, today])
  const inboxCount = useMemo(
    () => quotes.filter((quote) => quoteStatus(quote) === 'inbox' && !quote.deletedAt).length,
    [quotes]
  )

  const hasSignals = useMemo(
    () => quotes.some((quote) => quoteStatus(quote) === 'signal' && !quote.deletedAt),
    [quotes]
  )

  // Latest deck for callbacks that outlive a render (undo toasts).
  const dailyQuotesRef = useRef(dailyQuotes)
  useEffect(() => {
    dailyQuotesRef.current = dailyQuotes
  })

  if (index > dailyQuotes.length) setIndex(dailyQuotes.length)

  const currentIndex = Math.min(index, dailyQuotes.length)
  const currentQuote = dailyQuotes[currentIndex]
  // The visit had cards (also when all were rested or deleted since), so an empty deck means "finished", not "nothing due".
  const visitHadCards = browseIds ? browseIds.length > 0 : sessionQuoteIds.length > 0
  // A used-up browse deck keeps its list (so undoing the rest of its last card brings the card back); without a card it is not
  // "browsing" any more and the page shows the finished state, where "browse anyway" starts a new round.

  return {
    loading,
    dailyQuotes,
    currentIndex,
    currentQuote,
    nextQuote: dailyQuotes[currentIndex + 1],
    thirdQuote: dailyQuotes[currentIndex + 2],
    stackCompleted: visitHadCards && !currentQuote,
    // The Rückblick is built from the week's thoughts, so the nudge counts those.
    reflectionCount: weeklyThoughts,
    showReflectionNudge: weeklyThoughts >= 3,
    inboxCount,
    hasSignals,
    libraryEmpty: quotes.length === 0,
    browsing: browseIds !== null && Boolean(currentQuote),
    startBrowsing: () => {
      dismissUndoToast()
      const round = browseRound + 1
      if (browseIds === null) setDailyIndexBeforeBrowse(index)
      setBrowseRound(round)
      setBrowseIds(
        selectBrowseStack(quotes, { limit: dailyCount, seed: `${localDateKey(new Date())}:browse:${round}` }).map(
          (quote) => quote.id
        )
      )
      setIndex(0)
    },
    stopBrowsing: () => {
      dismissUndoToast()
      setBrowseIds(null)
      setIndex(dailyIndexBeforeBrowse)
    },
    advanceIndex: () => setIndex((value) => Math.min(value + 1, dailyQuotes.length)),
    // Puts the card with this id on top again; a card that is not in the current deck leaves the position alone.
    rewindTo: (id: string) => {
      const position = dailyQuotesRef.current.findIndex((quote) => quote.id === id)
      if (position >= 0) setIndex(position)
    },
    hideQuote: (id: string) => {
      const position = sessionQuoteIds.indexOf(id)
      if (!browseIds && position >= 0) hiddenPositions.current.set(id, position)
      setDiscardedIds((ids) => [...ids, id])
    },
    showQuote: (id: string) => {
      const position = hiddenPositions.current.get(id)
      hiddenPositions.current.delete(id)
      if (position !== undefined && !browseIds) {
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
