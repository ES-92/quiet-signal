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
  browsing: boolean
  advanceIndex: () => void
  hideQuote: (id: string) => void
  showQuote: (id: string) => void
}

// Card actions of the daily deck (more/less often, rest with undo, thought, discard with undo, context menu, inline book editor).
export function useTodayActions({ currentQuote, currentBook, browsing, advanceIndex, hideQuote, showQuote }: TodayActionsInput) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { saveQuote, likeQuote, moreOften, lessOften, restQuote, discardQuote, restoreQuote } = useQuoteStore()
  const { saveBook } = useBookStore()
  const { showToast } = useToastStore()
  const [contextOpen, setContextOpen] = useState(false)
  const [thoughtOpen, setThoughtOpen] = useState(false)
  const [bookEditorOpen, setBookEditorOpen] = useState(false)
  const [bookTitle, setBookTitle] = useState('')
  const [bookAuthor, setBookAuthor] = useState('')

  // Close the card-level popups whenever a different card comes to the top (adjusting state while rendering, not in an effect).
  const currentQuoteId = currentQuote?.id
  const [popupQuoteId, setPopupQuoteId] = useState(currentQuoteId)
  if (currentQuoteId !== popupQuoteId) {
    setPopupQuoteId(currentQuoteId)
    setContextOpen(false)
    setThoughtOpen(false)
    setBookEditorOpen(false)
  }

  // An undo toast of an earlier action would act on a card that is no longer where it was; the next deck action dismisses it.
  function dismissUndoToast() {
    const { toast, hideToast } = useToastStore.getState()
    if (toast?.onAction) hideToast()
  }

  // moreOften/lessOften already bump the review bookkeeping, so no separate like here.
  async function reviewWithInterval(change: (id: string) => Promise<number | undefined>) {
    if (!currentQuote) return
    const id = currentQuote.id
    dismissUndoToast()
    advanceIndex()
    try {
      const days = await change(id)
      if (typeof days === 'number') showToast({ message: t('comesBackInDays', { days }) })
    } catch {
      showToast({ message: t('saveFailed') })
    }
  }

  // Browsing never touches the intervals: → only likes the card, ← only moves on, neither shows a toast.
  async function likeWhileBrowsing() {
    if (!currentQuote) return
    const id = currentQuote.id
    dismissUndoToast()
    advanceIndex()
    try {
      await likeQuote(id)
    } catch {
      showToast({ message: t('saveFailed') })
    }
  }

  function handleMoreOften() {
    return browsing ? likeWhileBrowsing() : reviewWithInterval(moreOften)
  }

  function handleLessOften() {
    if (!browsing) return reviewWithInterval(lessOften)
    if (currentQuote) {
      dismissUndoToast()
      advanceIndex()
    }
    return Promise.resolve()
  }

  // Hides the card at once and rests it in the background; undo restores the previous snooze, a failure brings the card back.
  function handleRest() {
    if (!currentQuote) return
    const id = currentQuote.id
    const previousSnooze = currentQuote.snoozedUntil
    dismissUndoToast()
    restQuote(id).catch(() => {
      showQuote(id)
      showToast({ message: t('restFailed') })
    })
    hideQuote(id)
    showToast({
      message: t('restedToast'),
      actionLabel: t('undo'),
      onAction: () => {
        showQuote(id)
        saveQuote(id, { status: 'signal', snoozedUntil: previousSnooze }).catch(() => {
          // The undo did not persist: the card stays rested, so take it off the deck again.
          hideQuote(id)
          showToast({ message: t('saveFailed') })
        })
      }
    })
    // No advance: hiding the rested quote moves the next card into this slot.
  }

  function openThought() {
    if (!currentQuote) return
    dismissUndoToast()
    setThoughtOpen(true)
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

  async function handleFavoriteToggle() {
    if (!currentQuote) return
    tapHaptic(10)
    await saveQuote(currentQuote.id, { favorite: !currentQuote.favorite })
    setContextOpen(false)
  }

  function handleContextDiscard() {
    if (!currentQuote) return
    const id = currentQuote.id
    setContextOpen(false)
    discardWithUndo(id)
    // No advance: hiding the discarded quote moves the next card into this slot.
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
    handleMoreOften,
    handleLessOften,
    handleRest,
    thoughtOpen,
    openThought,
    closeThought: () => setThoughtOpen(false),
    handleFavoriteToggle,
    handleContextDiscard,
    handleOpenDetails,
    openBookEditor,
    handleSaveBook
  }
}
