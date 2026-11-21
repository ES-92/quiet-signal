import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n/useI18n'
import { tapHaptic } from '../services/haptics'
import type { Book } from '../types/book'
import type { Quote } from '../types/quote'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { useToastStore } from '../store/useToastStore'

interface TodayActionsInput {
  currentQuote: Quote | undefined
  currentBook: Book | undefined
  advanceIndex: () => void
  hideQuote: (id: string) => void
  showQuote: (id: string) => void
}

// Card actions of the daily deck (keep, snooze, discard with undo, context menu, inline book editor).
export function useTodayActions({ currentQuote, currentBook, advanceIndex, hideQuote, showQuote }: TodayActionsInput) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { saveQuote, likeQuote, dislikeQuote, snoozeQuote, discardQuote, restoreQuote } = useQuoteStore()
  const { saveBook } = useBookStore()
  const { showToast } = useToastStore()
  const [contextOpen, setContextOpen] = useState(false)
  const [bookEditorOpen, setBookEditorOpen] = useState(false)
  const [bookTitle, setBookTitle] = useState('')
  const [bookAuthor, setBookAuthor] = useState('')

  // Close the card-level popups whenever a different card comes to the top (adjusting state while rendering, not in an effect).
  const currentQuoteId = currentQuote?.id
  const [popupQuoteId, setPopupQuoteId] = useState(currentQuoteId)
  if (currentQuoteId !== popupQuoteId) {
    setPopupQuoteId(currentQuoteId)
    setContextOpen(false)
    setBookEditorOpen(false)
  }

  function handleKeep() {
    if (!currentQuote) return
    const id = currentQuote.id
    void likeQuote(id)
    advanceIndex()
  }

  // Hides the card at once and saves in the background; if saving fails, the card comes back with an error toast.
  function discardWithUndo(id: string) {
    discardQuote(id).catch(() => {
      showQuote(id)
      showToast({ message: t('discardFailed') })
    })
    hideQuote(id)
    showToast({
      message: t('discardedToast'),
      actionLabel: t('undo'),
      onAction: () => {
        showQuote(id)
        void restoreQuote(id)
      }
    })
  }

  function handleSnooze() {
    if (!currentQuote) return
    void snoozeQuote(currentQuote.id)
    advanceIndex()
  }

  function handleDiscard() {
    if (!currentQuote) return
    const id = currentQuote.id
    discardWithUndo(id)
    // No advance: hiding the discarded quote moves the next card into this slot.
  }

  async function handleFavoriteToggle() {
    if (!currentQuote) return
    tapHaptic(10)
    await saveQuote(currentQuote.id, { favorite: !currentQuote.favorite })
    setContextOpen(false)
  }

  function handleContextSnooze() {
    if (!currentQuote) return
    const id = currentQuote.id
    setContextOpen(false)
    void snoozeQuote(id)
    advanceIndex()
  }

  function handleContextDiscard() {
    if (!currentQuote) return
    const id = currentQuote.id
    setContextOpen(false)
    discardWithUndo(id)
    // No advance: hiding the discarded quote moves the next card into this slot.
  }

  function handleDislike() {
    if (!currentQuote) return
    void dislikeQuote(currentQuote.id)
    setContextOpen(false)
  }

  function handleOpenDetails() {
    if (!currentQuote) return
    tapHaptic(8)
    navigate(`/quote/${currentQuote.id}`)
  }

  function openBookEditor() {
    if (!currentBook) return
    tapHaptic(8)
    setBookTitle(currentBook.title)
    setBookAuthor(currentBook.author ?? '')
    setBookEditorOpen(true)
    setContextOpen(false)
  }

  async function handleSaveBook() {
    if (!currentBook || !bookTitle.trim()) return
    tapHaptic([8, 28, 8])
    await saveBook(currentBook.id, {
      title: bookTitle.trim(),
      author: bookAuthor.trim() || undefined
    })
    setBookEditorOpen(false)
  }

  return {
    contextOpen,
    openContext: () => setContextOpen(true),
    closeContext: () => setContextOpen(false),
    bookEditorOpen,
    closeBookEditor: () => setBookEditorOpen(false),
    bookTitle,
    setBookTitle,
    bookAuthor,
    setBookAuthor,
    handleKeep,
    handleSnooze,
    handleDiscard,
    handleFavoriteToggle,
    handleContextSnooze,
    handleContextDiscard,
    handleDislike,
    handleOpenDetails,
    openBookEditor,
    handleSaveBook
  }
}
