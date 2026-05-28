import { useI18n } from '../i18n/I18nProvider'
import { tapHaptic } from '../services/haptics'

interface GestureCoachProps {
  deck: 'today' | 'inbox'
  onDismiss: () => void
}

export function GestureCoach({ deck, onDismiss }: GestureCoachProps) {
  const { t } = useI18n()
  const rightLabel = deck === 'today' ? t('gestureKeep') : t('finishSignal')

  function dismiss() {
    tapHaptic(8)
    onDismiss()
  }

  return (
    <div
      className="quiet-fade absolute inset-0 z-30 flex flex-col items-center justify-center rounded-md bg-ink/15 backdrop-blur-[1px]"
      role="dialog"
      aria-label={t('gestures')}
      onPointerDown={(event) => {
        event.stopPropagation()
        dismiss()
      }}
    >
      <span className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-line bg-paper/90 px-3 py-1 text-xs text-graphite">
        ↑ {t('details')}
      </span>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-line bg-paper/90 px-3 py-1 text-xs text-graphite">
        ← {t('later')}
      </span>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-line bg-paper/90 px-3 py-1 text-xs text-graphite">
        {rightLabel} →
      </span>
      <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-clay/60 bg-paper/90 px-3 py-1 text-xs text-clay">
        ↓ {t('deleteNoise')}
      </span>
      <p className="pointer-events-none text-xs uppercase tracking-[0.18em] text-graphite">{t('coachFooter')}</p>
      <button
        type="button"
        className="quiet-touch mt-4 min-h-[44px] rounded-md bg-ink px-5 py-2 text-sm text-paper"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={dismiss}
      >
        {t('coachGotIt')}
      </button>
    </div>
  )
}
