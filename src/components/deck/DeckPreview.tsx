import { PhotoPreview } from '../PhotoCapture'
import { useI18n } from '../../i18n/I18nProvider'
import type { selectDailyStack } from '../../services/review'
import { lerp } from '../../utils/math'

const EXIT_MS = 620

export function DeckPreview({
  quote,
  depth,
  lift
}: {
  quote: NonNullable<ReturnType<typeof selectDailyStack>[number]>
  depth: 1 | 2
  lift: number
}) {
  const { t } = useI18n()
  const meta = [quote.author, quote.work, quote.year].filter(Boolean).join(', ')
  const baseY = depth === 1 ? 18 : 34
  const promotedY = depth === 1 ? -10 : 8
  const baseScale = depth === 1 ? 0.946 : 0.902
  const promotedScale = depth === 1 ? 0.992 : 0.956
  const baseOpacity = depth === 1 ? 0.82 : 0.5
  const promotedOpacity = depth === 1 ? 0.96 : 0.7
  const y = lerp(baseY, promotedY, lift)
  const scale = lerp(baseScale, promotedScale, lift)
  const opacity = lerp(baseOpacity, promotedOpacity, lift)
  const rotate = depth === 1 ? lerp(-0.7, 0.15, lift) : lerp(0.8, -0.2, lift)

  return (
    <article
      aria-hidden="true"
      className="daily-preview-card pointer-events-none absolute inset-x-4 bottom-2 top-8 z-10 flex min-h-0 flex-col justify-end overflow-hidden rounded-md border border-line bg-paper/95 p-4 shadow-[0_18px_46px_rgba(31,30,28,0.08)] will-change-transform sm:inset-x-8 sm:bottom-3 sm:top-12 sm:p-7"
      style={{
        opacity,
        transform: `translate3d(0, ${y}px, 0) rotate(${rotate}deg) scale(${scale})`,
        transition: `opacity ${lift === 1 ? EXIT_MS : 160}ms cubic-bezier(0.16, 1, 0.3, 1), transform ${lift === 1 ? EXIT_MS : 160}ms cubic-bezier(0.16, 1, 0.3, 1)`
      }}
    >
      <div className="flex shrink-0 justify-between text-[0.6rem] uppercase tracking-[0.18em] text-graphite">
        <span>{t('reviewStack')}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 overflow-hidden py-3">
        {quote.imageDataUrl && (
          <PhotoPreview
            src={quote.imageDataUrl}
            className="max-h-[22dvh] w-full rounded-md border border-line object-cover opacity-80"
          />
        )}
        <p className="line-clamp-2 break-words font-serif text-xl leading-[1.12] text-ink sm:text-3xl">
          {quote.text ? `"${quote.text}"` : quote.imageDataUrl ? t('untitledPhotoNote') : t('untitledVoiceNote')}
        </p>
      </div>
      <p className="truncate border-t border-line pt-2 text-xs text-graphite sm:text-sm">{meta}</p>
    </article>
  )
}
