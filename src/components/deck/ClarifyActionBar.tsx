import { ArrowRight, Clock3, Moon, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'

interface ClarifyActionBarProps {
  onFinish: () => void
  onToggleDetails: () => void
  onSnooze: () => void
  onRest: () => void
  onDelete: () => void
}

// Button alternative to the four swipe gestures; deleting (to the trash) is a separate, explicit button with no gesture.
export function ClarifyActionBar({ onFinish, onToggleDetails, onSnooze, onRest, onDelete }: ClarifyActionBarProps) {
  const { t } = useI18n()

  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-4 gap-2">
        <button
          className="quiet-touch inline-flex h-11 items-center justify-center rounded-full bg-ink text-paper shadow-[0_12px_28px_rgba(31,30,28,0.14)]"
          aria-label={t('finishSignal')}
          title={t('finishSignal')}
          onClick={onFinish}
        >
          <ArrowRight size={16} />
        </button>
        <button
          className="quiet-touch inline-flex h-11 items-center justify-center rounded-full border border-line text-graphite"
          aria-label={t('detailsAction')}
          title={t('detailsAction')}
          onClick={onToggleDetails}
        >
          <SlidersHorizontal size={16} />
        </button>
        <button
          className="quiet-touch inline-flex h-11 items-center justify-center rounded-full border border-line text-graphite"
          aria-label={t('later')}
          title={t('later')}
          onClick={onSnooze}
        >
          <Clock3 size={16} />
        </button>
        <button
          className="quiet-touch inline-flex h-11 items-center justify-center rounded-full border border-line text-graphite"
          aria-label={t('clarifyRest')}
          title={t('clarifyRest')}
          onClick={onRest}
        >
          <Moon size={16} />
        </button>
      </div>
      <button
        type="button"
        className="quiet-touch inline-flex min-h-[44px] items-center justify-center gap-2 justify-self-center rounded-full px-4 text-sm text-graphite hover:text-clay"
        onClick={onDelete}
      >
        <Trash2 size={15} />
        {t('deleteEntry')}
      </button>
    </div>
  )
}
