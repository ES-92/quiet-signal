import { Clock3, Flame } from 'lucide-react'
import { useFitText } from '../../hooks/useFitText'
import type { useSwipeDeck } from '../../hooks/useSwipeDeck'
import { useI18n } from '../../i18n/useI18n'
import type { Quote } from '../../types/quote'
import { lerp } from '../../utils/math'
import { AudioPlayer } from '../AudioRecorder'
import { PhotoPreview } from '../PhotoCapture'

interface TodayTopCardProps {
  quote: Quote
  position: number
  total: number
  deck: ReturnType<typeof useSwipeDeck>
}

// The draggable top card of the daily deck: swipe stamps, progress, text (fitted to the card), source and media.
export function TodayTopCard({ quote, position, total, deck }: TodayTopCardProps) {
  const { t } = useI18n()
  // Shrink long quotes to fit the card instead of clipping them.
  const { containerRef, textRef } = useFitText(quote.id)
  const likeHint = deck.hints.right
  const dislikeHint = deck.hints.left
  const topTransform = deck.exit
    ? `perspective(1100px) translate3d(${deck.exit.x}px, ${deck.exit.y}px, 0) rotate(${deck.exit.rotate}deg) scale(0.955)`
    : `perspective(1100px) translate3d(${deck.drag.x}px, ${deck.drag.y}px, 0) rotate(${deck.drag.x * 0.014 + deck.drag.y * 0.003}deg) scale(${1 - Math.min(Math.hypot(deck.drag.x, deck.drag.y) / 5200, 0.03)})`
  const cardShadow =
    deck.drag.active || deck.exit
      ? '0 36px 96px rgba(31,30,28,0.18), 0 12px 28px rgba(31,30,28,0.08)'
      : '0 26px 78px rgba(31,30,28,0.09), 0 2px 10px rgba(31,30,28,0.04)'

  return (
    <article
      key={quote.id}
      className={[
        'deck-top-card daily-card-surface absolute inset-x-2 bottom-4 top-0 z-20 flex min-h-0 flex-col overflow-hidden rounded-md border border-line bg-paper p-4 will-change-transform sm:inset-x-4 sm:bottom-6 sm:top-1 sm:p-8',
        deck.drag.active ? 'cursor-grabbing' : 'cursor-grab'
      ].join(' ')}
      style={{
        boxShadow: cardShadow,
        opacity: deck.exit ? 0.72 : 1,
        transform: topTransform,
        transition: deck.exit
          ? `opacity ${deck.exitMs}ms cubic-bezier(0.16, 1, 0.3, 1), transform ${deck.exitMs}ms cubic-bezier(0.16, 1, 0.3, 1)`
          : !deck.drag.active && deck.drag.x === 0 && deck.drag.y === 0
            ? 'box-shadow 360ms cubic-bezier(0.16, 1, 0.3, 1), transform 440ms cubic-bezier(0.18, 1.22, 0.22, 1)'
            : 'none'
      }}
    >
      <div className="daily-card-texture pointer-events-none absolute inset-0" />
      {/* Swipe stamps */}
      <div
        className="pointer-events-none absolute right-4 top-16 z-10 flex items-center gap-1.5 rounded-full border-2 border-clay bg-paper/80 px-3 py-1 text-sm font-medium uppercase tracking-wide text-clay shadow-[0_12px_34px_rgba(166,95,63,0.12)] backdrop-blur"
        style={{
          opacity: likeHint,
          transform: `translate3d(${lerp(12, 0, likeHint)}px, ${lerp(8, 0, likeHint)}px, 0) rotate(${lerp(6, 0, likeHint)}deg)`
        }}
      >
        <Flame size={16} fill="currentColor" /> {t('gestureMoreOften')}
      </div>
      <div
        className="pointer-events-none absolute left-4 top-16 z-10 flex items-center gap-1.5 rounded-full border-2 border-graphite bg-paper/80 px-3 py-1 text-sm font-medium uppercase tracking-wide text-graphite shadow-[0_12px_34px_rgba(31,30,28,0.1)] backdrop-blur"
        style={{
          opacity: dislikeHint,
          transform: `translate3d(${lerp(-12, 0, dislikeHint)}px, ${lerp(8, 0, dislikeHint)}px, 0) rotate(${lerp(-6, 0, dislikeHint)}deg)`
        }}
      >
        <Clock3 size={16} /> {t('gestureLessOften')}
      </div>

      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-clay/50 to-transparent" />
      <div className="flex shrink-0 items-center justify-between gap-3 text-[0.66rem] uppercase tracking-[0.18em] text-graphite sm:text-xs sm:tracking-[0.22em]">
        <span>{t('reviewStack')}</span>
        <span>{t('cardProgress', { current: position, total })}</span>
      </div>

      <div
        ref={containerRef}
        className="flex min-h-0 flex-1 flex-col justify-center gap-3 overflow-hidden py-3 sm:gap-5 sm:py-6"
      >
        {quote.imageDataUrl && (
          <div className="mx-auto w-full max-w-2xl shrink-0 overflow-hidden rounded-md">
            <PhotoPreview
              src={quote.imageDataUrl}
              className="max-h-[26dvh] w-full rounded-md border border-line object-cover sm:max-h-[34dvh]"
            />
          </div>
        )}

        {quote.text ? (
          <blockquote
            ref={(el) => {
              textRef.current = el
            }}
            className="break-words font-serif leading-[1.12] text-ink"
          >
            "{quote.text}"
          </blockquote>
        ) : (
          <h2
            ref={(el) => {
              textRef.current = el
            }}
            className="break-words font-serif leading-[1.12] text-ink"
          >
            {quote.imageDataUrl ? t('untitledPhotoNote') : t('untitledVoiceNote')}
          </h2>
        )}
      </div>

      <div className="shrink-0 border-t border-line pt-3 sm:pt-5">
        <p className="truncate text-sm text-graphite sm:text-base">
          {[quote.author, quote.work, quote.year].filter(Boolean).join(', ')}
        </p>
        {quote.audioDataUrl && (
          <div className="mt-3">
            <AudioPlayer src={quote.audioDataUrl} compact />
          </div>
        )}
        {quote.tags.length > 0 && (
          <div className="mt-3 flex max-h-9 flex-wrap gap-2 overflow-hidden sm:max-h-none">
            {quote.tags.slice(0, 6).map((tag) => (
              <span key={tag} className="rounded border border-line bg-paper px-2 py-1 text-xs text-graphite">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
