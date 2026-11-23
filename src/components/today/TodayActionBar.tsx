import { ArrowLeft, ArrowRight, Moon, MoreHorizontal, PenLine } from 'lucide-react'
import type { ReactNode } from 'react'
import { useI18n } from '../../i18n/useI18n'

interface TodayActionBarProps {
  onMoreOften: () => void
  onLessOften: () => void
  onThought: () => void
  onRest: () => void
  onMenu: () => void
  contextOpen?: boolean
  disabled?: boolean
  // Browse mode is read-only: only a thought and paging on are offered.
  browsing?: boolean
  onNext?: () => void
}

// Icon over a short visible label; at least 44 px high, and the label truncates instead of widening the column (fits 320 px).
const buttonClass =
  'quiet-touch inline-flex min-h-[44px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 py-1.5 disabled:pointer-events-none disabled:opacity-40'
const quietClass = `${buttonClass} border border-line text-graphite`

function Label({ children }: { children: ReactNode }) {
  return <span className="block max-w-full truncate text-[0.66rem] leading-none">{children}</span>
}

// Button alternative to the four swipe gestures plus the card menu; icons hint at the action (thought, rest) rather than the swipe direction.
export function TodayActionBar({
  onMoreOften,
  onLessOften,
  onThought,
  onRest,
  onMenu,
  contextOpen = false,
  disabled,
  browsing = false,
  onNext
}: TodayActionBarProps) {
  const { t } = useI18n()

  if (browsing) {
    return (
      <div className="grid w-full max-w-xs grid-cols-2 gap-2" role="toolbar" aria-label={t('cardActionBar')}>
        <button disabled={disabled} className={quietClass} aria-label={t('gestureThought')} title={t('gestureThought')} onClick={onThought}>
          <PenLine size={16} aria-hidden />
          <Label>{t('actionShortThought')}</Label>
        </button>
        <button
          disabled={disabled}
          className={`${buttonClass} bg-ink text-paper shadow-[0_12px_28px_rgba(31,30,28,0.14)]`}
          aria-label={t('next')}
          title={t('next')}
          onClick={onNext}
        >
          <ArrowRight size={16} aria-hidden />
          <Label>{t('next')}</Label>
        </button>
      </div>
    )
  }

  return (
    <div className="grid w-full grid-cols-5 gap-1.5 sm:gap-2" role="toolbar" aria-label={t('cardActionBar')}>
      <button disabled={disabled} className={quietClass} aria-label={t('gestureLessOften')} title={t('gestureLessOften')} onClick={onLessOften}>
        <ArrowLeft size={16} aria-hidden />
        <Label>{t('actionShortLess')}</Label>
      </button>
      <button disabled={disabled} className={quietClass} aria-label={t('gestureThought')} title={t('gestureThought')} onClick={onThought}>
        <PenLine size={16} aria-hidden />
        <Label>{t('actionShortThought')}</Label>
      </button>
      <button disabled={disabled} className={quietClass} aria-label={t('gestureRest')} title={t('gestureRest')} onClick={onRest}>
        <Moon size={16} aria-hidden />
        <Label>{t('actionShortRest')}</Label>
      </button>
      <button
        disabled={disabled}
        className={`${buttonClass} bg-ink text-paper shadow-[0_12px_28px_rgba(31,30,28,0.14)]`}
        aria-label={t('gestureMoreOften')}
        title={t('gestureMoreOften')}
        onClick={onMoreOften}
      >
        <ArrowRight size={16} aria-hidden />
        <Label>{t('actionShortMore')}</Label>
      </button>
      <button
        disabled={disabled}
        className={quietClass}
        aria-label={t('cardMenu')}
        aria-haspopup="menu"
        aria-expanded={contextOpen}
        title={t('cardMenu')}
        onClick={onMenu}
      >
        <MoreHorizontal size={16} aria-hidden />
        <Label>{t('cardMenu')}</Label>
      </button>
    </div>
  )
}
