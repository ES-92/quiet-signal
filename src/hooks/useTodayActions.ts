import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n/useI18n'
import { tapHaptic } from '../services/haptics'
import type { ReviewSnapshot } from '../services/lifecycle'
import type { Book } from '../types/book'
import type { Quote } from '../types/quote'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { dismissUndoToast, useToastStore } from '../store/useToastStore'

interface TodayActionsInput {
  currentQuote: Quote | undefined
  currentBook: Book | undefined
  browsing: boolean
  advanceIndex: () => void
  rewindTo: (id: string) => void
  hideQuote: (id: string) => void
  showQuote: (id: string) => void
}

// Card actions of the daily deck (more/less often, rest with undo, thought, discard with undo, context menu, inline book editor).
export function useTodayActions({ currentQuote, currentBook, browsing, advanceIndex, rewindTo, hideQuote, showQuote }: TodayActionsInput) {
  const { t, tCount } = useI18n()
  const navigate = useNavigate()
  const { saveQuote, likeQuote, moreOften, lessOften, restoreReview, restQuote, discardQuote, restoreQuote } = useQuoteStore()
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

  // Counts deck actions, so an answer that arrives late can tell whether a newer action has taken over the toast slot.
  const actionSeq = useRef(0)
  // The card on top right now, for undo callbacks that were created for an earlier card.
  const topQuoteId = useRef(currentQuoteId)
  useEffect(() => {
    topQuoteId.current = currentQuoteId
  })

  // Every deck action dismisses the undo toast of the previous one and claims the toast slot.
  function beginDeckAction() {
    dismissUndoToast()
    actionSeq.current += 1
    return actionSeq.current
  }

  // moreOften/lessOften already bump the review bookkeeping, so no separate like here.
  async function reviewWithInterval(
    change: (id: string, onPrevious: (previous: ReviewSnapshot) => void) => Promise<number | undefined>
  ) {
    if (!currentQuote) return
    const id = currentQuote.id
    const seq = beginDeckAction()
    advanceIndex()
    try {
      // Captured from the row the change was applied to, so the undo restores exactly that state.
      let previous: ReviewSnapshot | undefined
      const days = await change(id, (snapshot) => {
        previous = snapshot
      })
      // A newer deck action owns the toast slot by now; a late "comes back" toast would wipe its toast.
      if (typeof days !== 'number' || seq !== actionSeq.current) return
      showToast({
        message: tCount('comesBackInDays', days),
        ...(previous && {
          actionLabel: t('undo'),
          onAction: () => {
            const restore = previous
            if (!restore) return
            // Jump to the card by id: the deck may have moved on since, so stepping back one could land on another card.
            const resumeId = topQuoteId.current
            rewindTo(id)
            restoreReview(id, restore).catch(() => {
              if (resumeId) rewindTo(resumeId)
              else advanceIndex()
              showToast({ message: t('saveFailed') })
            })
          }
        })
      })
    } catch {
      showToast({ message: t('saveFailed') })
    }
  }

  // Browsing never touches the intervals: → only likes the card, ← only moves on, neither shows a toast.
  async function likeWhileBrowsing() {
    if (!currentQuote) return
    const id = currentQuote.id
    beginDeckAction()
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
      beginDeckAction()
      advanceIndex()
    }
    return Promise.resolve()
  }

  // Hides the card at once and rests it in the background; undo restores the previous snooze, a failure brings the card back.
  function handleRest() {
    if (!currentQuote) return
    const id = currentQuote.id
    const previousSnooze = currentQuote.snoozedUntil
    beginDeckAction()
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
    beginDeckAction()
    setThoughtOpen(true)
  }

  // Hides the card at once and saves in the background; if saving fails, the card comes back with an error toast.
  function discardWithUndo(id: string) {
    beginDeckAction()
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
