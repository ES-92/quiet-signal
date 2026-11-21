import { BookMarked, Heart, Sun, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AudioPlayer } from '../components/AudioRecorder'
import { ConfirmSheet } from '../components/ConfirmSheet'
import { LikeControl } from '../components/LikeControl'
import { PhotoPreview } from '../components/PhotoCapture'
import { QuoteForm } from '../components/QuoteForm'
import { ThoughtList } from '../components/thoughts/ThoughtList'
import { ThoughtSheet } from '../components/thoughts/ThoughtSheet'
import { useI18n } from '../i18n/useI18n'
import { statusChangePatch } from '../services/lifecycle'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { useToastStore } from '../store/useToastStore'
import { entryType, quoteStatus, signalStrength, type QuoteInput } from '../types/quote'

export function QuoteDetailPage() {
  const { t } = useI18n()
  const { id } = useParams()
  const navigate = useNavigate()
  const { quotes, loadQuotes, saveQuote, likeQuote, dislikeQuote, removeQuote, addThought, editThought, removeThought, adoptNote, wakeQuote } = useQuoteStore()
  const { showToast } = useToastStore()
  const { books, loadBooks } = useBookStore()
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [thoughtSheetOpen, setThoughtSheetOpen] = useState(false)

  useEffect(() => {
    void loadQuotes()
    void loadBooks()
  }, [loadQuotes, loadBooks])

  const quote = quotes.find((item) => item.id === id)
  const book = quote?.bookId ? books.find((item) => item.id === quote.bookId) : undefined
  const statusLabels = {
    inbox: 'entryStatus_inbox',
    signal: 'entryStatus_signal',
    rest: 'entryStatus_rest'
  } as const
  const strengthLabels = {
    quiet: 'signalStrength_quiet',
    normal: 'signalStrength_normal',
    strong: 'signalStrength_strong'
  } as const
  const typeLabels = {
    note: 'entryType_note',
    memory: 'entryType_memory',
    book_quote: 'entryType_book_quote',
    idea: 'entryType_idea',
    conversation: 'entryType_conversation',
    observation: 'entryType_observation'
  } as const

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

  async function handleSubmit(input: QuoteInput) {
    if (!id || !quote) return
    // Moving between states (e.g. noise to signal) carries the matching schedule fields.
    const patch = statusChangePatch(quoteStatus(quote), input.status ?? quoteStatus(quote))
    await saveQuote(id, { ...input, ...patch })
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

  async function handleAdoptNote() {
    if (!quote) return
    // The user is on this page and the undo is immediate, so restoring from this snapshot is safe.
    const previousNote = quote.note
    const previousThoughts = quote.thoughts
    const adopted = await attempt(() => adoptNote(quote.id))
    if (!adopted) return
    showToast({
      message: t('adoptNoteToast'),
      actionLabel: t('undo'),
      onAction: () => void attempt(() => saveQuote(quote.id, { note: previousNote, thoughts: previousThoughts }))
    })
  }

  async function handleDelete() {
    if (!id) return
    setDeleteConfirmOpen(true)
  }

  async function confirmDeleteQuote() {
    if (!id) return
    await removeQuote(id)
    setDeleteConfirmOpen(false)
    navigate('/library')
  }

  return (
    <div className="grid gap-6 pt-3 sm:gap-8 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_25rem]">
      <section className="grid min-w-0 gap-5 sm:gap-6">
        <div className="min-w-0">
          <p className="text-sm uppercase tracking-[0.2em] text-graphite">{quote.imageDataUrl && !quote.text ? t('photoNote') : quote.audioDataUrl && !quote.text ? t('voiceNote') : t('quote')}</p>
          {quote.imageDataUrl && (
            <div className="mt-4 max-w-3xl">
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
              onRemove={(thoughtId) => void attempt(() => removeThought(quote.id, thoughtId))}
            />
          )}
          <button
            className="inline-flex min-h-[44px] w-fit items-center rounded-md border border-line px-3 py-2 text-sm text-graphite"
            onClick={() => setThoughtSheetOpen(true)}
          >
            {t('addThought')}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm text-graphite">
          <Metric label={t('likesLabel')} value={String(quote.likes)} />
          <Metric label={t('favorite')} value={quote.favorite ? t('yes') : t('no')} />
          <Metric label={t('entryKind')} value={t(typeLabels[entryType(quote)])} />
          <Metric label={t('entryStatus')} value={t(statusLabels[quoteStatus(quote)])} />
          <Metric label={t('signalStrength')} value={t(strengthLabels[signalStrength(quote)])} />
          {quote.occurredAt && <Metric label={t('occurredAt')} value={new Date(quote.occurredAt).toLocaleString()} />}
          {quote.locationName && <Metric label={t('locationLabel')} value={quote.locationName} />}
          {quote.people?.length ? <Metric label={t('people')} value={quote.people.join(', ')} /> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LikeControl
            likes={quote.likes}
            onLike={() => void likeQuote(quote.id)}
            onDislike={() => void dislikeQuote(quote.id)}
          />
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
            onClick={() => void saveQuote(quote.id, { favorite: !quote.favorite })}
          >
            <Heart size={16} fill={quote.favorite ? 'currentColor' : 'none'} /> {t('favorite')}
          </button>
          <button className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-clay px-3 py-2 text-sm text-clay" onClick={() => void handleDelete()}>
            <Trash2 size={16} /> {t('delete')}
          </button>
        </div>
      </section>
      <aside className="rounded-md border border-line bg-white/30 p-5">
        <h2 className="font-serif text-3xl">{t('edit')}</h2>
        <div className="mt-5">
          <QuoteForm quote={quote} submitLabel={t('saveChanges')} onSubmit={handleSubmit} />
        </div>
      </aside>
      {thoughtSheetOpen && <ThoughtSheet thoughts={sortedThoughts} onSave={saveThought} onClose={() => setThoughtSheetOpen(false)} />}
      <ConfirmSheet
        open={deleteConfirmOpen}
        title={t('delete')}
        description={t('deleteQuoteConfirm')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={confirmDeleteQuote}
      />
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-white/30 p-3">
      <p className="text-xs uppercase tracking-[0.16em]">{label}</p>
      <p className="mt-2 text-ink">{value}</p>
    </div>
  )
}
