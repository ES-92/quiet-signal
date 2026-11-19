import { Feather } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n/useI18n'
import { tapHaptic } from '../../services/haptics'

interface TodayHeaderProps {
  showReflectionNudge: boolean
  reflectionCount: number
}

// Date headline plus the weekly-reflection shortcut (or the capture hint when there is nothing to reflect on yet).
export function TodayHeader({ showReflectionNudge, reflectionCount }: TodayHeaderProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const todayLabel = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long' }).format(new Date())

  return (
    <section className="flex min-w-0 items-end justify-between gap-4 pt-1 sm:pt-3">
      <div className="min-w-0">
        <p className="text-[0.66rem] uppercase tracking-[0.22em] text-graphite sm:text-xs">{t('today')}</p>
        <h1 className="mt-1 truncate font-serif text-3xl leading-tight sm:text-5xl">{todayLabel}</h1>
      </div>
      {showReflectionNudge ? (
        <button
          type="button"
          className="quiet-touch quiet-fade inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-clay/45 bg-paper/82 px-3 text-clay shadow-[0_14px_36px_rgba(31,30,28,0.08)] backdrop-blur transition duration-200 hover:border-clay hover:bg-white/40 active:scale-[0.98]"
          aria-label={t('openReflections')}
          title={t('reflectionNudge')}
          onClick={() => {
            tapHaptic(8)
            navigate('/reflections')
          }}
        >
          <Feather size={16} />
          <span className="hidden text-xs uppercase tracking-[0.16em] sm:inline">{t('reflectionNudge')}</span>
          <span className="rounded-full bg-clay/10 px-1.5 py-0.5 text-xs tabular-nums">{reflectionCount}</span>
        </button>
      ) : (
        <p className="hidden max-w-44 text-right text-xs leading-5 text-graphite sm:block">{t('swipeDownCapture')}</p>
      )}
    </section>
  )
}
