import { useI18n } from '../../i18n/I18nProvider'
import type { Quote } from '../../types/quote'
import { lerp } from '../../utils/math'

export function ClarifyPreviewCard({ quote, depth, lift }: { quote: Quote; depth: 1 | 2; lift: number }) {
  const { t } = useI18n()
  const y = depth === 1 ? lerp(18, 2, lift) : lerp(34, 16, lift)
  const scale = depth === 1 ? lerp(0.946, 0.982, lift) : lerp(0.902, 0.948, lift)
  const opacity = depth === 1 ? lerp(0.76, 0.92, lift) : lerp(0.44, 0.64, lift)
  const rotate = depth === 1 ? lerp(-0.6, 0.1, lift) : lerp(0.8, -0.2, lift)

  return (
    <article
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-4 top-7 z-10 min-h-[16.5rem] overflow-hidden rounded-md border border-line bg-paper/80 p-4 shadow-[0_18px_46px_rgba(31,30,28,0.08)] will-change-transform"
      style={{
        opacity,
        transform: `translate3d(0, ${y}px, 0) rotate(${rotate}deg) scale(${scale})`,
        transition: 'opacity 220ms cubic-bezier(0.16, 1, 0.3, 1), transform 220ms cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div className="flex flex-wrap gap-2">
        <span className="rounded border border-line px-2 py-1 text-xs text-graphite">{t('entryStatus_inbox')}</span>
      </div>
      <p className="mt-5 line-clamp-4 break-words font-serif text-2xl leading-tight text-ink">
        {quote.text ? `"${quote.text}"` : quote.imageDataUrl ? t('untitledPhotoNote') : t('untitledVoiceNote')}
      </p>
    </article>
  )
}
