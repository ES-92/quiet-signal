import { ArrowLeft, ArrowRight, Moon, MoreHorizontal, PenLine } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'

interface TodayActionBarProps {
  onMoreOften: () => void
  onLessOften: () => void
  onThought: () => void
  onRest: () => void
  onMenu: () => void
  contextOpen?: boolean
  disabled?: boolean
}

const buttonClass = 'quiet-touch inline-flex h-11 items-center justify-center rounded-full border border-line text-graphite disabled:pointer-events-none disabled:opacity-40'

// Button alternative to the four swipe gestures plus the card menu; icons hint at the action (thought, rest) rather than the swipe direction.
export function TodayActionBar({ onMoreOften, onLessOften, onThought, onRest, onMenu, contextOpen = false, disabled }: TodayActionBarProps) {
  const { t } = useI18n()

  return (
    <div className="grid w-full grid-cols-5 gap-2" role="toolbar" aria-label={t('cardActionBar')}>
      <button disabled={disabled} className={buttonClass} aria-label={t('gestureLessOften')} title={t('gestureLessOften')} onClick={onLessOften}>
        <ArrowLeft size={16} />
      </button>
      <button disabled={disabled} className={buttonClass} aria-label={t('gestureThought')} title={t('gestureThought')} onClick={onThought}>
        <PenLine size={16} />
      </button>
      <button disabled={disabled} className={buttonClass} aria-label={t('gestureRest')} title={t('gestureRest')} onClick={onRest}>
        <Moon size={16} />
      </button>
      <button
        disabled={disabled}
        className="quiet-touch inline-flex h-11 items-center justify-center rounded-full bg-ink text-paper shadow-[0_12px_28px_rgba(31,30,28,0.14)] disabled:pointer-events-none disabled:opacity-40"
        aria-label={t('gestureMoreOften')}
        title={t('gestureMoreOften')}
        onClick={onMoreOften}
      >
        <ArrowRight size={16} />
      </button>
      <button
        disabled={disabled}
        className={buttonClass}
        aria-label={t('cardMenu')}
        aria-haspopup="menu"
        aria-expanded={contextOpen}
        title={t('cardMenu')}
        onClick={onMenu}
      >
        <MoreHorizontal size={16} />
      </button>
    </div>
  )
}
