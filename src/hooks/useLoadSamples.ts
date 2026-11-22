import { sampleSeed } from '../services/sampleData'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'

// Loads the built-in sample books and entries into the library (used by the empty states).
export function useLoadSamples() {
  const importQuotes = useQuoteStore((state) => state.importQuotes)
  const importBooks = useBookStore((state) => state.importBooks)

  return async function loadSamples() {
    const seed = sampleSeed()
    await importBooks(seed.books)
    await importQuotes(seed.quotes)
  }
}
