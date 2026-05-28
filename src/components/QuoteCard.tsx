import { BookOpen, Clock, ExternalLink, Heart, MapPin, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/I18nProvider'
import { entryType, quoteStatus, signalStrength, type Quote } from '../types/quote'
import { AudioPlayer } from './AudioRecorder'
import { LikeControl } from './LikeControl'
import { PhotoPreview } from './PhotoCapture'

interface QuoteCardProps {
  quote: Quote
  onRead?: (id: string) => void
  onLater?: (id: string) => void
  onFavorite?: (id: string) => void
  onLike?: (id: string) => void
  onDislike?: (id: string) => void
  compact?: boolean
}

export function QuoteCard({ quote, onRead, onLater, onFavorite, onLike, onDislike, compact = false }: QuoteCardProps) {
  const { t } = useI18n()
  const meta = [quote.author, quote.work, quote.year].filter(Boolean).join(', ')
  const strength = signalStrength(quote)
  const status = quoteStatus(quote)
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
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded border border-line px-2 py-1 text-xs text-graphite">
          {t(typeLabels[entryType(quote)])}
        </span>
        <span className="rounded border border-clay/60 px-2 py-1 text-xs text-clay">
          {status === 'inbox' ? t('entryStatus_inbox') : t(strengthLabels[strength])}
        </span>
        {quote.locationName && (
          <span className="inline-flex items-center gap-1 rounded border border-line px-2 py-1 text-xs text-graphite">
            <MapPin size={12} /> {quote.locationName}
          </span>
        )}
        {quote.people?.slice(0, 2).map((person) => (
          <span key={person} className="inline-flex items-center gap-1 rounded border border-line px-2 py-1 text-xs text-graphite">
            <UserRound size={12} /> {person}
          </span>
        ))}
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
        {onLike && (
          <LikeControl
            likes={quote.likes}
            onLike={() => onLike(quote.id)}
            onDislike={() => onDislike?.(quote.id)}
            compact={compact}
            className={compact ? 'rounded-full' : undefined}
          />
        )}
        {onFavorite && (
          <button
            className={[
              compact
                ? 'quiet-touch inline-flex h-10 w-10 items-center justify-center rounded-full border'
                : 'inline-flex min-h-[44px] items-center gap-2 rounded-md border px-3 py-2 text-sm',
              quote.favorite ? 'border-clay text-clay' : 'border-line text-graphite'
            ].join(' ')}
            onClick={() => onFavorite(quote.id)}
            aria-label={t('favorite')}
            title={t('favorite')}
          >
            <Heart size={16} fill={quote.favorite ? 'currentColor' : 'none'} /> <span className={compact ? 'sr-only' : ''}>{t('favorite')}</span>
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
