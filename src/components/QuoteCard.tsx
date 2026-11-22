import { BookOpen, Clock, Clock3, ExternalLink, Heart, Sun } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/useI18n'
import { dueInDays, formatDueIn, overdueDays } from '../services/dueLabel'
import { quoteStatus, type Quote } from '../types/quote'
import { AudioPlayer } from './AudioRecorder'
import { PhotoPreview } from './PhotoCapture'

interface QuoteCardProps {
  quote: Quote
  onRead?: (id: string) => void
  onLater?: (id: string) => void
  onFavorite?: (id: string) => void
  onWake?: (id: string) => void
  compact?: boolean
}

export function QuoteCard({ quote, onRead, onLater, onFavorite, onWake, compact = false }: QuoteCardProps) {
  const { t, tCount, locale } = useI18n()
  const meta = [quote.author, quote.work, quote.year].filter(Boolean).join(', ')
  const status = quoteStatus(quote)
  const thoughtCount = quote.thoughts?.length ?? 0
  // When it comes back: short and relative. Unsorted entries have no schedule yet, so they show no time.
  const now = new Date()
  type Fact = { text: string; label?: string }
  const thoughts: Fact | undefined = thoughtCount > 0 ? { text: tCount('cardThoughts', thoughtCount) } : undefined
  let comesBack: Fact | undefined
  if (status === 'rest') {
    comesBack = { text: t('cardResting') }
  } else if (status === 'signal') {
    const text = overdueDays(quote, now) > 0 ? t('cardOverdue') : formatDueIn(dueInDays(quote, now), locale)
    // The clock icon and a spoken prefix tell that this is the return time, not just a bare "in 2 days".
    comesBack = { text, label: t('cardComesBack', { when: text }) }
  }
  const facts = [thoughts, comesBack].filter((fact): fact is Fact => fact !== undefined)

  return (
    <article className="classical-panel min-w-0 rounded-md p-4 sm:p-6">
      {quote.imageDataUrl && (
        <div className="mb-5">
          <PhotoPreview src={quote.imageDataUrl} />
        </div>
      )}
      {quote.text ? (
        <blockquote
          className={[
            'font-serif leading-snug text-ink',
            'break-words',
            compact ? 'text-xl sm:text-3xl' : 'text-2xl sm:text-5xl'
          ].join(' ')}
        >
          "{quote.text}"
        </blockquote>
      ) : (
        <p className={['break-words font-serif leading-snug text-ink', compact ? 'text-xl sm:text-3xl' : 'text-2xl sm:text-5xl'].join(' ')}>
          {quote.imageDataUrl ? t('untitledPhotoNote') : t('untitledVoiceNote')}
        </p>
      )}
      {quote.audioDataUrl && (
        <div className="mt-5">
          <AudioPlayer src={quote.audioDataUrl} />
        </div>
      )}
      {meta && <p className="mt-4 text-sm text-graphite">{meta}</p>}
      {facts.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-graphite">
          {facts.map((fact, index) => (
            <span key={index} className="inline-flex items-center gap-2">
              {index > 0 && <span aria-hidden="true">·</span>}
              {fact.label ? (
                <span role="img" aria-label={fact.label} className="inline-flex items-center gap-1">
                  <Clock3 size={14} aria-hidden="true" /> {fact.text}
                </span>
              ) : (
                fact.text
              )}
            </span>
          ))}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {status === 'inbox' && (
          <span className="rounded border border-clay/60 px-2 py-1 text-xs text-clay">{t('entryStatus_inbox')}</span>
        )}
        {quote.tags.map((tag) => (
          <span key={tag} className="rounded border border-line px-2 py-1 text-xs text-graphite">
            {tag}
          </span>
        ))}
      </div>
      <div className={['mt-6 flex flex-wrap items-center gap-2', compact ? 'border-t border-line pt-3' : ''].join(' ')}>
        {onRead && (
          <button
            className={compact ? 'quiet-touch inline-flex h-10 w-10 items-center justify-center rounded-full bg-ink text-paper' : 'inline-flex min-h-[44px] items-center gap-2 rounded-md bg-ink px-3 py-2 text-sm text-paper'}
            onClick={() => onRead(quote.id)}
            aria-label={t('read')}
            title={t('read')}
          >
            <BookOpen size={16} /> <span className={compact ? 'sr-only' : ''}>{t('read')}</span>
          </button>
        )}
        {onLater && (
          <button
            className={compact ? 'quiet-touch inline-flex h-10 w-10 items-center justify-center rounded-full border border-line text-graphite' : 'inline-flex min-h-[44px] items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-graphite'}
            onClick={() => onLater(quote.id)}
            aria-label={t('later')}
            title={t('later')}
          >
            <Clock size={16} /> <span className={compact ? 'sr-only' : ''}>{t('later')}</span>
          </button>
        )}
        {onWake && (
          <button
            className={compact ? 'quiet-touch inline-flex h-10 w-10 items-center justify-center rounded-full border border-clay text-clay' : 'inline-flex min-h-[44px] items-center gap-2 rounded-md border border-clay px-3 py-2 text-sm text-clay'}
            onClick={() => onWake(quote.id)}
            aria-label={t('wake')}
            title={t('wake')}
          >
            <Sun size={16} /> <span className={compact ? 'sr-only' : ''}>{t('wake')}</span>
          </button>
        )}
        {onFavorite && (
          <button
            className={[
              compact
                ? 'quiet-touch inline-flex h-10 w-10 items-center justify-center rounded-full border'
                : 'inline-flex min-h-[44px] items-center gap-2 rounded-md border px-3 py-2 text-sm',
              quote.favorite ? 'border-clay bg-clay/10 text-clay' : 'border-line text-graphite'
            ].join(' ')}
            onClick={() => onFavorite(quote.id)}
            aria-label={t('favorite')}
            aria-pressed={Boolean(quote.favorite)}
            title={t('favorite')}
          >
            <Heart size={16} strokeWidth={quote.favorite ? 2.25 : 2} fill={quote.favorite ? 'currentColor' : 'none'} /> <span className={compact ? 'sr-only' : ''}>{t('favorite')}</span>
          </button>
        )}
        <Link
          className={compact ? 'quiet-touch inline-flex h-10 w-10 items-center justify-center rounded-full border border-line text-graphite' : 'inline-flex min-h-[44px] items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-graphite'}
          to={`/quote/${quote.id}`}
          aria-label={t('open')}
          title={t('open')}
        >
          <ExternalLink size={16} /> <span className={compact ? 'sr-only' : ''}>{t('open')}</span>
        </Link>
      </div>
    </article>
  )
}
