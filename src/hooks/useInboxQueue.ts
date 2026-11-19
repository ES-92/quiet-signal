import { useEffect, useMemo } from 'react'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { isSnoozed, quoteStatus } from '../types/quote'

// Loads quotes and books on mount and returns the inbox entries in deck order.
export function useInboxQueue() {
  const { quotes, loadedAt, loadQuotes } = useQuoteStore()
  const { books, loadBooks } = useBookStore()

  useEffect(() => {
    void loadQuotes()
    void loadBooks()
  }, [loadQuotes, loadBooks])

  const inboxQuotes = useMemo(() => {
    return quotes
      .filter((quote) => quoteStatus(quote) === 'inbox')
      .filter((quote) => !isSnoozed(quote, loadedAt))
      .sort((a, b) => {
        const aDue = a.snoozedUntil ? new Date(a.snoozedUntil).getTime() : 0
        const bDue = b.snoozedUntil ? new Date(b.snoozedUntil).getTime() : 0
        // Recently-unsnoozed entries first, then oldest-created first (FIFO).
        if (aDue !== bDue) return bDue - aDue
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      })
  }, [quotes, loadedAt])

  return { inboxQuotes, books }
}
