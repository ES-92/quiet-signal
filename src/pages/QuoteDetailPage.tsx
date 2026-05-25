import { BookMarked, Heart, Trash2 } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AudioPlayer } from '../components/AudioRecorder'
import { LikeControl } from '../components/LikeControl'
import { PhotoPreview } from '../components/PhotoCapture'
import { QuoteForm } from '../components/QuoteForm'
import { useI18n } from '../i18n/I18nProvider'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import type { QuoteInput } from '../types/quote'

export function QuoteDetailPage() {
  const { t } = useI18n()
  const { id } = useParams()
  const navigate = useNavigate()
  const { quotes, loadQuotes, saveQuote, likeQuote, dislikeQuote, removeQuote } = useQuoteStore()
  const { books, loadBooks } = useBookStore()

  useEffect(() => {
    void loadQuotes()
    void loadBooks()
  }, [loadQuotes, loadBooks])

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

  async function handleSubmit(input: QuoteInput) {
    if (!id) return
    await saveQuote(id, input)
  }

  async function handleDelete() {
    if (!id) return
    await removeQuote(id)
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
        <div className="grid grid-cols-2 gap-3 text-sm text-graphite">
          <Metric label={t('likesLabel')} value={String(quote.likes)} />
          <Metric label={t('favorite')} value={quote.favorite ? t('yes') : t('no')} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LikeControl
            likes={quote.likes}
            onLike={() => void likeQuote(quote.id)}
            onDislike={() => void dislikeQuote(quote.id)}
          />
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
