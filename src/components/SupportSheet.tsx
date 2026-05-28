import { Coffee, CreditCard, Heart, X } from 'lucide-react'
import { useEffect, useId } from 'react'
import { useI18n } from '../i18n/I18nProvider'

interface SupportSheetProps {
  open: boolean
  onClose: () => void
}

export function SupportSheet({ open, onClose }: SupportSheetProps) {
  const { t } = useI18n()
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="quiet-fade fixed inset-0 z-50 flex items-end bg-ink/10 backdrop-blur-[2px]" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="quiet-sheet mx-auto mb-3 grid w-[min(32rem,calc(100vw-1.5rem))] gap-4 rounded-md border border-line bg-paper/95 p-5 shadow-[0_-24px_80px_rgba(31,30,28,0.2)] sm:mb-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto h-1 w-12 rounded-full bg-ink/20" />
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-ink text-paper">
              <Heart size={18} />
            </span>
            <h2 id={titleId} className="font-serif text-2xl">{t('supportSheetTitle')}</h2>
          </div>
          <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-line text-graphite" onClick={onClose} aria-label={t('close')}>
            <X size={17} />
          </button>
        </div>
        <p className="text-sm leading-6 text-graphite">{t('supportSheetBody')}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <a href="https://ko-fi.com/esc92" target="_blank" rel="noreferrer" className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm text-paper">
            <Coffee size={16} /> Ko-fi
          </a>
          <a href="https://paypal.me/ErikSchroeder92" target="_blank" rel="noreferrer" className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-md border border-line px-4 text-sm text-ink">
            <CreditCard size={16} /> PayPal
          </a>
        </div>
      </section>
    </div>
  )
}
