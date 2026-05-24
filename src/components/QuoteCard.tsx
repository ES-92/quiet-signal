import { BookOpen, Clock, Flame, Heart, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/I18nProvider'
import type { Quote } from '../types/quote'
import { AudioPlayer } from './AudioRecorder'
import { PhotoPreview } from './PhotoCapture'

interface QuoteCardProps {
  quote: Quote
  onRead?: (id: string) => void
  onLater?: (id: string) => void
  onFavorite?: (id: string) => void
  onLike?: (id: string) => void
  compact?: boolean
}

export function QuoteCard({ quote, onRead, onLater, onFavorite, onLike, compact = false }: QuoteCardProps) {
  const { t } = useI18n()
  const meta = [quote.author, quote.work, quote.year].filter(Boolean).join(', ')

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
          “{quote.text}”
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
      {quote.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {quote.tags.map((tag) => (
            <span key={tag} className="rounded border border-line px-2 py-1 text-xs text-graphite">
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {onRead && (
          <button className="inline-flex items-center gap-2 rounded-md bg-ink px-3 py-2 text-sm text-paper" onClick={() => onRead(quote.id)}>
            <BookOpen size={16} /> {t('read')}
          </button>
        )}
        {onLater && (
          <button className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-graphite" onClick={() => onLater(quote.id)}>
            <Clock size={16} /> {t('later')}
          </button>
        )}
        {onLike && (
          <button
            className={[
              'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
              quote.likes > 0 ? 'border-clay text-clay' : 'border-line text-graphite'
            ].join(' ')}
            onClick={() => onLike(quote.id)}
            aria-label={t('like')}
          >
            <Flame size={16} fill={quote.likes > 0 ? 'currentColor' : 'none'} />
            <span key={quote.likes} className="like-pop tabular-nums">
              {quote.likes > 0 ? quote.likes : t('like')}
            </span>
          </button>
        )}
        {onFavorite && (
          <button
            className={[
              'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
              quote.favorite ? 'border-clay text-clay' : 'border-line text-graphite'
            ].join(' ')}
            onClick={() => onFavorite(quote.id)}
          >
            <Heart size={16} fill={quote.favorite ? 'currentColor' : 'none'} /> {t('favorite')}
          </button>
        )}
        <Link className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-graphite" to={`/quote/${quote.id}`}>
          <RotateCcw size={16} /> {t('open')}
        </Link>
      </div>
    </article>
  )
}
