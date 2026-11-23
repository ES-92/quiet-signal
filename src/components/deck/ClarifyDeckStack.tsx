import { ArrowRight, Clock3, Moon, SlidersHorizontal } from 'lucide-react'
import type { useSwipeDeck } from '../../hooks/useSwipeDeck'
import { useI18n } from '../../i18n/useI18n'
import { quoted } from '../../i18n/quotes'
import { daysUnclarified } from '../../services/lifecycle'
import type { Quote } from '../../types/quote'
import { AudioPlayer } from '../AudioRecorder'
import { GestureCoach } from '../GestureCoach'
import { ClarifyPreviewCard } from './ClarifyPreviewCard'
import { GestureStamp } from './GestureStamp'

interface ClarifyDeckStackProps {
  quote: Quote
  nextQuote?: Quote
  thirdQuote?: Quote
  deck: ReturnType<typeof useSwipeDeck>
  coachVisible: boolean
  onDismissCoach: () => void
}

// The swipeable top card with up to two preview cards behind it and the one-time gesture coach on top.
export function ClarifyDeckStack({
  quote,
  nextQuote,
  thirdQuote,
  deck,
  coachVisible,
  onDismissCoach
}: ClarifyDeckStackProps) {
  const { t, language } = useI18n()
  const unclarifiedDays = daysUnclarified(quote)
  const clarifyLift = deck.exit ? 1 : Math.min(1, Math.hypot(deck.drag.x, deck.drag.y) / 132)

  return (
    <div className="relative min-h-[19rem] overflow-hidden px-1 py-2" style={{ perspective: '1100px' }}>
      {thirdQuote && <ClarifyPreviewCard quote={thirdQuote} depth={2} lift={clarifyLift} />}
      {nextQuote && <ClarifyPreviewCard quote={nextQuote} depth={1} lift={clarifyLift} />}
      <article
        className="clarify-top-card relative z-20 min-h-[16.5rem] touch-none select-none overflow-hidden rounded-md border border-line bg-paper p-4 shadow-[0_22px_62px_rgba(31,30,28,0.14)] will-change-transform"
        {...deck.bind}
        style={{
          opacity: deck.exit ? 0.72 : 1,
          transform: deck.exit
            ? `translate3d(${deck.exit.x}px, ${deck.exit.y}px, 0) rotate(${deck.exit.rotate}deg) scale(0.95)`
            : `perspective(1000px) translate3d(${deck.drag.x}px, ${deck.drag.y}px, 0) rotate(${deck.drag.x * 0.012}deg) scale(${1 - Math.min(Math.hypot(deck.drag.x, deck.drag.y) / 6200, 0.022)})`,
          transition: deck.exit
            ? `opacity ${deck.exitMs}ms cubic-bezier(0.16, 1, 0.3, 1), transform ${deck.exitMs}ms cubic-bezier(0.16, 1, 0.3, 1)`
            : deck.drag.active
              ? 'none'
              : 'transform 420ms cubic-bezier(0.18, 1.22, 0.22, 1), box-shadow 280ms cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <GestureStamp className="right-3 top-16 border-clay text-clay" opacity={deck.hints.right} rotate={5} x={12}>
          <ArrowRight size={15} /> {t('finishSignal')}
        </GestureStamp>
        <GestureStamp
          className="left-3 top-16 border-graphite text-graphite"
          opacity={deck.hints.left}
          rotate={-5}
          x={-12}
        >
          <Clock3 size={15} /> {t('later')}
        </GestureStamp>
        <GestureStamp
          className="left-1/2 top-3 -translate-x-1/2 border-graphite text-graphite"
          opacity={deck.hints.up}
          rotate={0}
          y={-10}
        >
          <SlidersHorizontal size={15} /> {t('detailsAction')}
        </GestureStamp>
        <GestureStamp
          className="bottom-3 left-1/2 -translate-x-1/2 border-graphite text-graphite"
          opacity={deck.hints.down}
          rotate={0}
          y={10}
        >
          <Moon size={15} /> {t('clarifyRest')}
        </GestureStamp>

        <div className="flex flex-wrap gap-2">
          <span className="rounded border border-line px-2 py-1 text-xs text-graphite">{t('entryStatus_inbox')}</span>
        </div>
        {unclarifiedDays >= 7 && (
          <p className="mt-2 text-xs text-graphite">{t('unclarifiedSince', { days: unclarifiedDays })}</p>
        )}
        {quote.imageDataUrl && (
          <img
            className="mt-4 max-h-56 w-full rounded-md border border-line object-cover"
            src={quote.imageDataUrl}
            alt={t('photoNote')}
          />
        )}
        {quote.text ? (
          <blockquote className="mt-4 break-words font-serif text-2xl leading-tight sm:text-4xl">
            {quoted(quote.text, quote.author, language)}
          </blockquote>
        ) : (
          <p className="mt-4 break-words font-serif text-2xl leading-tight sm:text-4xl">
            {quote.imageDataUrl ? t('untitledPhotoNote') : t('untitledVoiceNote')}
          </p>
        )}
        {quote.audioDataUrl && (
          <div className="mt-4">
            <AudioPlayer src={quote.audioDataUrl} compact />
          </div>
        )}
        {quote.note && <p className="mt-4 text-sm leading-6 text-graphite">{quote.note}</p>}
      </article>
      {coachVisible && <GestureCoach deck="inbox" onDismiss={onDismissCoach} />}
    </div>
  )
}
