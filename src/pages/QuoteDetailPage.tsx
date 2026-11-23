import { BookMarked, Heart, Pencil, Sun, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AudioPlayer } from '../components/AudioRecorder'
import { EntryInfoLine } from '../components/EntryInfoLine'
import { PhotoPreview } from '../components/PhotoCapture'
import { QuoteForm } from '../components/QuoteForm'
import { ThoughtList } from '../components/thoughts/ThoughtList'
import { ThoughtSheet } from '../components/thoughts/ThoughtSheet'
import { useI18n } from '../i18n/useI18n'
import { statusChangePatch } from '../services/lifecycle'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { useToastStore } from '../store/useToastStore'
import { quoteStatus, type QuoteInput, type Thought } from '../types/quote'

export function QuoteDetailPage() {
  const { t } = useI18n()
  const { id } = useParams()
  const navigate = useNavigate()
  const { quotes, loadQuotes, saveQuote, toggleFavorite, discardQuote, restoreQuote, addThought, editThought, removeThought, restoreThought, adoptNote, undoAdoptNote, wakeQuote } = useQuoteStore()
  const { showToast } = useToastStore()
  const { books, loadBooks } = useBookStore()
  const [thoughtSheetOpen, setThoughtSheetOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const editFormRef = useRef<HTMLElement>(null)

  useEffect(() => {
    void loadQuotes()
    void loadBooks()
  }, [loadQuotes, loadBooks])

  // Opening the form moves focus to its first field.
  useEffect(() => {
    if (editing) editFormRef.current?.querySelector<HTMLElement>('textarea, input, select')?.focus()
  }, [editing])

  // Collapsing the form (toggle or saved) puts focus back on the button that opened it, so it is not lost with the removed form.
  function closeEditing() {
    setEditing(false)
    editButtonRef.current?.focus()
  }

  const quote = quotes.find((item) => item.id === id)
  const book = quote?.bookId ? books.find((item) => item.id === quote.bookId) : undefined
  if (!quote) {
    return (
      <div className="pt-10">
        <p className="text-graphite">{t('quoteNotFound')}</p>
        <Link className="mt-4 inline-block rounded-md bg-ink px-4 py-2 text-sm text-paper" to="/library">
          {t('backToLibrary')}
        </Link>
      </div>
    )
  }

  const sortedThoughts = [...(quote.thoughts ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  async function handleSubmit(changes: Partial<QuoteInput>) {
    if (!id) return
    // Moving between states (e.g. noise to signal) carries the matching schedule fields; only a status the user actually changed counts.
    const previous = useQuoteStore.getState().quotes.find((item) => item.id === id)
    const patch = changes.status && previous ? statusChangePatch(quoteStatus(previous), changes.status) : {}
    // The form keeps its values and stays open on failure; the toast tells the user the save did not happen. A saved form collapses.
    if (await attempt(() => saveQuote(id, { ...changes, ...patch }))) closeEditing()
  }

  // Runs a store action and reports failure with a toast instead of an unhandled rejection.
  async function attempt(action: () => Promise<void>) {
    try {
      await action()
      return true
    } catch {
      showToast({ message: t('saveFailed') })
      return false
    }
  }

  async function saveThought(text: string) {
    if (!id) return
    if (await attempt(() => addThought(id, text))) setThoughtSheetOpen(false)
  }

  // Deleting is one tap, so the toast offers to put the thought back exactly as it was.
  async function handleRemoveThought(thought: Thought) {
    if (!id) return
    if (!(await attempt(() => removeThought(id, thought.id)))) return
    showToast({
      message: t('thoughtDeleted'),
      actionLabel: t('undo'),
      onAction: () => void attempt(() => restoreThought(id, thought))
    })
  }

  async function handleAdoptNote() {
    if (!quote) return
    // Undo removes only the adopted thought (by id) and restores the note, so thoughts added in between survive.
    const previousNote = quote.note
    let adoptedId: string | undefined
    const adopted = await attempt(async () => {
      adoptedId = await adoptNote(quote.id)
    })
    if (!adopted || !adoptedId) return
    const thoughtId = adoptedId
    showToast({
      message: t('adoptNoteToast'),
      actionLabel: t('undo'),
      onAction: () => void attempt(() => undoAdoptNote(quote.id, thoughtId, previousNote))
    })
  }

  // Like the card menu on Today: the entry moves to the trash with undo; only the trash deletes permanently.
  async function handleDelete() {
    if (!id) return
    if (!(await attempt(() => discardQuote(id)))) return
    showToast({
      message: t('discardedToast'),
      actionLabel: t('undo'),
      onAction: () => void attempt(() => restoreQuote(id))
    })
    navigate('/library')
  }

  return (
    <div className="grid max-w-3xl gap-6 pt-3 sm:gap-8 sm:pt-10">
      <section className="grid min-w-0 gap-5 sm:gap-6">
        <div className="min-w-0">
          {quote.imageDataUrl && (
            <div className="max-w-3xl">
              <PhotoPreview src={quote.imageDataUrl} />
            </div>
          )}
          {quote.text ? (
            <blockquote className="mt-3 break-words font-serif text-3xl leading-tight sm:text-5xl">"{quote.text}"</blockquote>
          ) : (
            <h1 className="mt-3 break-words font-serif text-3xl leading-tight sm:text-5xl">{quote.imageDataUrl ? t('untitledPhotoNote') : t('untitledVoiceNote')}</h1>
          )}
          <p className="mt-4 text-graphite">{[quote.author, quote.work, quote.year].filter(Boolean).join(', ')}</p>
          {book && (
            <Link
              to={`/books/${book.id}`}
              className="mt-3 inline-flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm text-graphite transition hover:border-clay hover:text-clay"
            >
              <BookMarked size={15} /> {book.title}
            </Link>
          )}
        </div>
        {quote.audioDataUrl && <AudioPlayer src={quote.audioDataUrl} />}
        {quote.note && (
          <div className="rounded-md border border-line bg-white/30 p-5">
            <p className="text-sm uppercase tracking-[0.2em] text-graphite">{t('note')}</p>
            <p className="mt-2 leading-7">{quote.note}</p>
          </div>
        )}
        {quote.text.trim() && quote.note?.trim() && (
          <button
            className="inline-flex min-h-[44px] w-fit items-center rounded-md border border-line px-3 py-2 text-sm text-graphite"
            onClick={() => void handleAdoptNote()}
          >
            {t('adoptNote')}
          </button>
        )}
        <div className="grid gap-3 rounded-md border border-line bg-white/30 p-5">
          <h2 className="text-sm uppercase tracking-[0.2em] text-graphite">{t('thoughtsTitle')}</h2>
          {sortedThoughts.length > 0 && (
            <ThoughtList
              thoughts={sortedThoughts}
              onEdit={(thoughtId, text) => void attempt(() => editThought(quote.id, thoughtId, text))}
              onRemove={(thoughtId) => {
                const removed = sortedThoughts.find((item) => item.id === thoughtId)
                if (removed) void handleRemoveThought(removed)
              }}
            />
          )}
          <button
            className="inline-flex min-h-[44px] w-fit items-center rounded-md border border-line px-3 py-2 text-sm text-graphite"
            onClick={() => setThoughtSheetOpen(true)}
          >
            {t('addThought')}
          </button>
        </div>
        <EntryInfoLine quote={quote} />
        <div className="flex flex-wrap items-center gap-2">
          {quoteStatus(quote) === 'rest' && (
            <button
              className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-clay px-3 py-2 text-sm text-clay"
              onClick={() => void attempt(() => wakeQuote(quote.id))}
            >
              <Sun size={16} /> {t('wake')}
            </button>
          )}
          <button
            className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-graphite"
            aria-pressed={Boolean(quote.favorite)}
            onClick={() => void attempt(() => toggleFavorite(quote.id))}
          >
            <Heart size={16} fill={quote.favorite ? 'currentColor' : 'none'} /> {t('favorite')}
          </button>
          <button className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-clay px-3 py-2 text-sm text-clay" onClick={() => void handleDelete()}>
            <Trash2 size={16} /> {t('delete')}
          </button>
          <button
            className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-graphite"
            aria-expanded={editing}
            aria-controls={editing ? 'quote-edit-form' : undefined}
            ref={editButtonRef}
            onClick={() => (editing ? closeEditing() : setEditing(true))}
          >
            <Pencil size={16} /> {t('edit')}
          </button>
        </div>
      </section>
      {editing && (
        <section id="quote-edit-form" ref={editFormRef} className="rounded-md border border-line bg-white/30 p-5">
          <QuoteForm quote={quote} submitLabel={t('saveChanges')} onSubmit={handleSubmit} />
        </section>
      )}
      {thoughtSheetOpen && <ThoughtSheet thoughts={sortedThoughts} onSave={saveThought} onClose={() => setThoughtSheetOpen(false)} />}
    </div>
  )
}
