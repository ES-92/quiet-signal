import { useState } from 'react'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'

export function useClearAllData() {
  const clearQuotes = useQuoteStore((state) => state.clearAll)
  const clearBooks = useBookStore((state) => state.clearAll)
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function confirm() {
    await Promise.all([clearQuotes(), clearBooks()])
    setConfirmOpen(false)
  }

  return { confirmOpen, request: () => setConfirmOpen(true), cancel: () => setConfirmOpen(false), confirm }
}
